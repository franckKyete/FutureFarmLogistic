import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  DeliveryRunStatus,
  DeliveryStopStatus,
  DeliveryStopType,
  CreateDeliveryRunDto,
  UpdateDeliveryRunDto,
  SkipStopDto,
  PushLocationDto,
  OrderLineStatus,
  PickupReportStatus,
  SubmitPickupReportDto,
} from '@futurefarm/types';
import { DeliveryRunEntity } from './entities/delivery-run.entity';
import { DeliveryStopEntity } from './entities/delivery-stop.entity';
import { DriverLocationEntity } from './entities/driver-location.entity';
import { PickupReportEntity } from './entities/pickup-report.entity';
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import {
  ROUTE_OPTIMIZER_PORT,
  type RouteOptimizerPort,
  type LatLon,
} from './interfaces/route-optimizer.port';
import { STORAGE_PORT, type StoragePort } from './interfaces/storage.port';
import { VehiclesService } from './vehicles.service';
import { LogisticsGateway } from './logistics.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationChannel, NotificationPriority } from '@futurefarm/types';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor(
    @InjectRepository(DeliveryRunEntity)
    private readonly runRepo: Repository<DeliveryRunEntity>,
    @InjectRepository(DeliveryStopEntity)
    private readonly stopRepo: Repository<DeliveryStopEntity>,
    @InjectRepository(DriverLocationEntity)
    private readonly locationRepo: Repository<DriverLocationEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLineRepo: Repository<OrderLineEntity>,
    @InjectRepository(PickupReportEntity)
    private readonly pickupReportRepo: Repository<PickupReportEntity>,
    private readonly vehiclesService: VehiclesService,
    private readonly dataSource: DataSource,
    @Inject(ROUTE_OPTIMIZER_PORT)
    private readonly routeOptimizer: RouteOptimizerPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    // Gateway is injected lazily (forwardRef) to avoid circular dependency
    @Inject('LOGISTICS_GATEWAY')
    private readonly gateway: LogisticsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Delivery Runs
  // -------------------------------------------------------------------------

  async createRun(dto: CreateDeliveryRunDto): Promise<DeliveryRunEntity> {
    return this.dataSource.transaction(async (manager) => {
      const run = new DeliveryRunEntity();
      run.driverId = dto.driverId ?? null;
      run.vehicleId = dto.vehicleId ?? null;
      run.scheduledAt = new Date(dto.scheduledAt);
      run.notes = dto.notes ?? null;
      run.status = DeliveryRunStatus.PLANNED;
      const savedRun = await manager.save(DeliveryRunEntity, run);

      // Persist stops in provided order first
      const stops: DeliveryStopEntity[] = [];
      for (let i = 0; i < dto.stops.length; i++) {
        const s = dto.stops[i]!;
        const stop = new DeliveryStopEntity();
        stop.runId = savedRun.id;
        stop.orderLineId = s.orderLineId;
        stop.type = s.type;
        stop.sequence = i;
        stop.address = s.address;
        stop.notes = s.notes ?? null;
        stop.status = DeliveryStopStatus.PENDING;
        stops.push(await manager.save(DeliveryStopEntity, stop));
        // Auto-create PickupReport in PENDING status for each COLLECTION stop
        if (s.type === DeliveryStopType.COLLECTION) {
          const report = manager.create(PickupReportEntity, {
            stopId: stop.id,
            driverId: dto.driverId ?? null,
            orderLineId: s.orderLineId,
            status: PickupReportStatus.PENDING,
          });
          const savedReport = await manager.save(PickupReportEntity, report);
          stop.pickupReportId = savedReport.id;
          await manager.save(DeliveryStopEntity, stop);
        }
      }

      // Run OSRM optimisation if we have ≥2 stops
      if (stops.length >= 2) {
        const waypoints: LatLon[] = stops.map((s) => ({
          id:  s.id,
          lat: s.address.lat,
          lon: s.address.lon,
        }));

        try {
          const optimised = await this.routeOptimizer.optimise(waypoints);
          savedRun.optimisedRoute   = optimised.orderedWaypoints as unknown as object;
          savedRun.totalDistanceKm  = optimised.totalDistanceKm;

          const baseTime = savedRun.scheduledAt.getTime();
          const offsets = optimised.durationOffsetPerStop || {};

          // Re-sequence stops according to optimised order and set ETA
          for (let idx = 0; idx < optimised.orderedWaypoints.length; idx++) {
            const wp    = optimised.orderedWaypoints[idx]!;
            const stop  = stops[wp.originalIndex]!;
            stop.sequence = idx;
            
            const offsetSec = offsets[idx] ?? (idx * (optimised.totalDurationSec / (optimised.orderedWaypoints.length - 1 || 1)));
            const stopEta = new Date(baseTime + offsetSec * 1000);
            stop.eta = stopEta;
            
            await manager.save(DeliveryStopEntity, stop);
          }
        } catch (err) {
          this.logger.warn(`OSRM optimisation failed, keeping original order: ${(err as Error).message}`);
        }

        await manager.save(DeliveryRunEntity, savedRun);
      }

      const runWithRelations = await manager.findOne(DeliveryRunEntity, {
        where: { id: savedRun.id },
        relations: [
          'driver',
          'vehicle',
          'stops',
          'stops.pickupReport',
          'stops.orderLine',
          'stops.orderLine.harvest',
          'stops.orderLine.harvest.product',
          'stops.orderLine.order',
          'stops.orderLine.order.buyer',
        ],
      });

      if (!runWithRelations) {
        throw new NotFoundException(`Delivery run ${savedRun.id} not found after creation`);
      }

      if (runWithRelations.stops) {
        runWithRelations.stops.sort((a, b) => a.sequence - b.sequence);
      }

      // Notify driver if assigned immediately upon creation
      if (runWithRelations.driverId) {
        const stopsList = runWithRelations.stops || [];
        const origin = stopsList[0]?.address?.city || stopsList[0]?.address?.street || 'Point de collecte';
        const destination = stopsList[stopsList.length - 1]?.address?.city || stopsList[stopsList.length - 1]?.address?.street || 'Destination';
        const formattedDate = runWithRelations.scheduledAt.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

        // 1. Send multi-channel notification (Database, SMS, Email, Push)
        void this.notificationsService.send({
          recipientIds: [runWithRelations.driverId],
          title: 'Nouvelle tournée de livraison assignée',
          body: `Vous avez été assigné à une nouvelle tournée (${stopsList.length} arrêts) prévue le ${formattedDate} (${origin} ➔ ${destination}).`,
          channels: [
            NotificationChannel.DATABASE,
            NotificationChannel.EMAIL,
            NotificationChannel.SMS,
            NotificationChannel.PUSH,
          ],
          priority: NotificationPriority.HIGH,
          metadata: {
            runId: runWithRelations.id,
            actionUrl: `/driver/runs/${runWithRelations.id}`,
            actionText: 'Voir la tournée',
          },
        }).catch((err) => {
          this.logger.warn(`Failed to send notification to driver ${runWithRelations.driverId}: ${(err as Error).message}`);
        });

        // 2. Real-time WebSocket dispatch event
        this.gateway.emitRunAssigned(runWithRelations.driverId, {
          runId: runWithRelations.id,
          scheduledAt: runWithRelations.scheduledAt.toISOString(),
          originCity: origin,
          destinationCity: destination,
          stopsCount: stopsList.length,
          totalDistanceKm: runWithRelations.totalDistanceKm || undefined,
        });
      }

      return runWithRelations;
    });
  }

  async listAllRuns(page = 1, limit = 20): Promise<{ data: DeliveryRunEntity[]; total: number }> {
    const [data, total] = await this.runRepo.findAndCount({
      order:     { scheduledAt: 'DESC' },
      relations: ['driver', 'vehicle', 'stops', 'stops.pickupReport'],
      skip:      (page - 1) * limit,
      take:      limit,
    });
    return { data, total };
  }

  async listMyRuns(driverId: string): Promise<DeliveryRunEntity[]> {
    return this.runRepo.find({
      where:     { driverId },
      order:     { scheduledAt: 'DESC' },
      relations: [
        'vehicle',
        'stops',
        'stops.pickupReport',
        'stops.orderLine',
        'stops.orderLine.harvest',
        'stops.orderLine.harvest.product',
        'stops.orderLine.farmerProfile',
        'stops.orderLine.farmerProfile.user',
        'stops.orderLine.order',
        'stops.orderLine.order.buyer',
      ],
    });
  }

  async getRun(id: string): Promise<DeliveryRunEntity> {
    const run = await this.runRepo.findOne({
      where:     { id },
      relations: [
        'driver',
        'vehicle',
        'stops',
        'stops.pickupReport',
        'stops.orderLine',
        'stops.orderLine.harvest',
        'stops.orderLine.harvest.product',
        'stops.orderLine.farmerProfile',
        'stops.orderLine.farmerProfile.user',
        'stops.orderLine.order',
        'stops.orderLine.order.buyer',
      ],
    });
    if (!run) throw new NotFoundException(`Delivery run ${id} not found`);
    // Sort stops by sequence
    if (run.stops) {
      run.stops.sort((a, b) => a.sequence - b.sequence);
    }
    return run;
  }

  async updateRun(id: string, dto: UpdateDeliveryRunDto): Promise<DeliveryRunEntity> {
    const run = await this.getRun(id);
    if (run.status !== DeliveryRunStatus.PLANNED) {
      throw new BadRequestException('Only PLANNED runs can be updated');
    }
    if (dto.scheduledAt) run.scheduledAt = new Date(dto.scheduledAt);
    if (dto.notes !== undefined) run.notes = dto.notes;
    await this.runRepo.save(run);
    return this.getRun(id);
  }

  async assignDriver(runId: string, driverId: string): Promise<DeliveryRunEntity> {
    const run = await this.getRun(runId);
    if (run.status === DeliveryRunStatus.COMPLETED || run.status === DeliveryRunStatus.CANCELLED) {
      throw new BadRequestException('Cannot assign driver to a completed or cancelled run');
    }
    run.driverId = driverId;
    await this.runRepo.save(run);

    const updated = await this.getRun(runId);
    const stops = updated.stops || [];
    const originStop = stops[0];
    const destStop = stops[stops.length - 1];

    const formattedDate = updated.scheduledAt.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Send multi-channel notification (Database, SMS, Email, Push)
    void this.notificationsService.send({
      recipientIds: [driverId],
      title: 'Nouvelle tournée de livraison assignée',
      body: `Vous avez été assigné à une nouvelle tournée (${stops.length} arrêts) prévue le ${formattedDate} (${originStop?.address?.city || 'Origine'} ➔ ${destStop?.address?.city || 'Destination'}).`,
      channels: [
        NotificationChannel.DATABASE,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.PUSH,
      ],
      priority: NotificationPriority.HIGH,
      metadata: {
        runId: updated.id,
        actionUrl: `/driver/runs/${updated.id}`,
        actionText: 'Voir la tournée',
      },
    }).catch((err) => {
      this.logger.warn(`Failed to send assignment notification to driver ${driverId}: ${(err as Error).message}`);
    });

    // 2. Emit real-time dispatch notification to driver's personal room
    this.gateway.emitRunAssigned(driverId, {
      runId: updated.id,
      scheduledAt: updated.scheduledAt.toISOString(),
      originCity: originStop?.address?.city || originStop?.address?.street || 'Origine',
      destinationCity: destStop?.address?.city || destStop?.address?.street || 'Destination',
      stopsCount: stops.length,
      totalDistanceKm: updated.totalDistanceKm || undefined,
    });

    return updated;
  }

  async unassignDriver(runId: string): Promise<DeliveryRunEntity> {
    const run = await this.getRun(runId);
    if (run.status !== DeliveryRunStatus.PLANNED) {
      throw new BadRequestException('Can only unassign driver from a PLANNED run');
    }
    run.driverId = null;
    await this.runRepo.save(run);
    this.gateway.emitRunStatusUpdate(runId, DeliveryRunStatus.PLANNED);
    return this.getRun(runId);
  }

  async assignVehicle(runId: string, vehicleId: string): Promise<DeliveryRunEntity> {
    const run = await this.getRun(runId);
    if (run.status === DeliveryRunStatus.COMPLETED || run.status === DeliveryRunStatus.CANCELLED) {
      throw new BadRequestException('Cannot assign vehicle to a completed or cancelled run');
    }
    // Verify vehicle exists
    await this.vehiclesService.findOne(vehicleId);
    run.vehicleId = vehicleId;
    await this.runRepo.save(run);
    return this.getRun(runId);
  }

  async optimiseRun(runId: string): Promise<DeliveryRunEntity> {
    const run = await this.getRun(runId);
    if (run.status !== DeliveryRunStatus.PLANNED) {
      throw new BadRequestException('Only PLANNED runs can be re-optimised');
    }

    const pendingStops = run.stops.filter((s) => s.status === DeliveryStopStatus.PENDING);
    if (pendingStops.length < 2) return run;

    const waypoints: LatLon[] = pendingStops.map((s) => ({
      id:  s.id,
      lat: s.address.lat,
      lon: s.address.lon,
    }));

    const optimised = await this.routeOptimizer.optimise(waypoints);
    run.optimisedRoute  = optimised.orderedWaypoints as unknown as object;
    run.totalDistanceKm = optimised.totalDistanceKm;

    const baseTime = run.scheduledAt.getTime();
    const offsets = optimised.durationOffsetPerStop || {};

    for (let idx = 0; idx < optimised.orderedWaypoints.length; idx++) {
      const wp   = optimised.orderedWaypoints[idx]!;
      const stop = pendingStops[wp.originalIndex]!;
      stop.sequence = idx;
      
      const offsetSec = offsets[idx] ?? (idx * (optimised.totalDurationSec / (optimised.orderedWaypoints.length - 1 || 1)));
      const stopEta = new Date(baseTime + offsetSec * 1000);
      stop.eta = stopEta;
      
      await this.stopRepo.save(stop);
    }
    await this.runRepo.save(run);
    return this.getRun(runId);
  }

  async startRun(runId: string, driverId: string): Promise<DeliveryRunEntity> {
    const run = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    if (run.status !== DeliveryRunStatus.PLANNED) {
      throw new BadRequestException('Run is not in PLANNED status');
    }
    run.status    = DeliveryRunStatus.IN_PROGRESS;
    run.startedAt = new Date();
    await this.runRepo.save(run);
    this.gateway.emitRunStatusUpdate(runId, DeliveryRunStatus.IN_PROGRESS);
    return this.getRun(runId);
  }

  async cancelRun(runId: string): Promise<DeliveryRunEntity> {
    const run = await this.getRun(runId);
    if (run.status === DeliveryRunStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed run');
    }
    run.status = DeliveryRunStatus.CANCELLED;
    await this.runRepo.save(run);
    this.gateway.emitRunStatusUpdate(runId, DeliveryRunStatus.CANCELLED);
    return this.getRun(runId);
  }

  // -------------------------------------------------------------------------
  // Delivery Stops
  // -------------------------------------------------------------------------

  private async getStop(runId: string, stopId: string): Promise<DeliveryStopEntity> {
    const stop = await this.stopRepo.findOne({
      where: { id: stopId, runId },
    });
    if (!stop) throw new NotFoundException(`Stop ${stopId} not found in run ${runId}`);
    return stop;
  }

  async arriveAtStop(runId: string, stopId: string, driverId: string): Promise<DeliveryStopEntity> {
    const run  = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    const stop = await this.getStop(runId, stopId);
    if (stop.status !== DeliveryStopStatus.PENDING) {
      throw new BadRequestException(`Stop is already ${stop.status}`);
    }
    stop.status    = DeliveryStopStatus.ARRIVED;
    stop.arrivedAt = new Date();
    await this.stopRepo.save(stop);
    this.gateway.emitStopStatusUpdate(stopId, DeliveryStopStatus.ARRIVED, null);
    return stop;
  }

  /**
   * Driver submits pickup inspection report for a COLLECTION stop.
   */
  async submitPickupReport(
    runId:    string,
    stopId:   string,
    driverId: string,
    dto:      SubmitPickupReportDto,
  ): Promise<PickupReportEntity> {
    const run = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    const stop = await this.getStop(runId, stopId);
    if (stop.type !== DeliveryStopType.COLLECTION) {
      throw new BadRequestException('Pickup reports are only available on COLLECTION stops');
    }
    if (stop.status !== DeliveryStopStatus.ARRIVED) {
      throw new BadRequestException('Driver must arrive at stop before submitting a pickup report');
    }

    let report: PickupReportEntity | null = null;
    if (stop.pickupReportId) {
      report = await this.pickupReportRepo.findOne({ where: { id: stop.pickupReportId } });
    }

    if (!report) {
      report = this.pickupReportRepo.create({
        stopId: stop.id,
        driverId,
        orderLineId: stop.orderLineId,
      });
    }

    report.driverId = driverId;
    report.quantityVerified = dto.quantityVerified;
    report.conditionOk = dto.conditionOk;
    report.packagingIntact = dto.packagingIntact;
    report.weightActualKg = dto.weightActualKg;
    report.notes = dto.notes ?? null;
    report.status = PickupReportStatus.SUBMITTED;
    report.submittedAt = new Date();

    const saved = await this.pickupReportRepo.save(report);
    if (stop.pickupReportId !== saved.id) {
      stop.pickupReportId = saved.id;
      await this.stopRepo.save(stop);
    }

    return saved;
  }

  async uploadProofPhoto(
    runId:     string,
    stopId:    string,
    driverId:  string,
    buffer:    Buffer,
    filename:  string,
    mimeType:  string,
  ): Promise<DeliveryStopEntity> {
    const run  = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    const stop = await this.getStop(runId, stopId);

    const url = await this.storage.upload(buffer, filename, mimeType);
    stop.proofPhotoUrl = url;
    return this.stopRepo.save(stop);
  }

  async completeStop(
    runId:    string,
    stopId:   string,
    driverId: string,
  ): Promise<DeliveryStopEntity> {
    const run  = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    const stop = await this.getStop(runId, stopId);
    if (stop.status !== DeliveryStopStatus.ARRIVED) {
      throw new BadRequestException('Stop must be in ARRIVED status to complete');
    }

    // Gate 1: Proof photo is strictly enforced on all stops (COLLECTION and DELIVERY)
    if (!stop.proofPhotoUrl) {
      throw new BadRequestException('A proof photo must be uploaded before completing this stop');
    }

    // Gate 2: COLLECTION stops require a completed pickup report
    if (stop.type === DeliveryStopType.COLLECTION) {
      if (!stop.pickupReportId) {
        throw new BadRequestException(
          'A pickup report must be submitted before completing a COLLECTION stop',
        );
      }
      const report = await this.pickupReportRepo.findOne({ where: { id: stop.pickupReportId } });
      if (!report || report.status !== PickupReportStatus.SUBMITTED) {
        throw new BadRequestException(
          'A pickup report must be submitted before completing a COLLECTION stop',
        );
      }
    }

    stop.status      = DeliveryStopStatus.COMPLETED;
    stop.completedAt = new Date();
    await this.stopRepo.save(stop);

    // Propagate to Orders: mark OrderLine as DELIVERED for DELIVERY stops
    if (stop.type === DeliveryStopType.DELIVERY) {
      await this.orderLineRepo.update(stop.orderLineId, {
        status: OrderLineStatus.DELIVERED,
      });
      this.logger.log(`OrderLine ${stop.orderLineId} marked DELIVERED by logistics stop ${stopId}`);
    }

    this.gateway.emitStopStatusUpdate(stopId, DeliveryStopStatus.COMPLETED, stop.completedAt);

    // Check if all stops are done → complete the run
    await this.checkRunCompletion(runId);

    return stop;
  }

  async skipStop(
    runId:    string,
    stopId:   string,
    driverId: string,
    dto:      SkipStopDto,
  ): Promise<DeliveryStopEntity> {
    const run  = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    const stop = await this.getStop(runId, stopId);
    if (stop.status === DeliveryStopStatus.COMPLETED || stop.status === DeliveryStopStatus.SKIPPED) {
      throw new BadRequestException(`Stop is already ${stop.status}`);
    }
    stop.status     = DeliveryStopStatus.SKIPPED;
    stop.skipReason = dto.reason;
    await this.stopRepo.save(stop);
    this.gateway.emitStopStatusUpdate(stopId, DeliveryStopStatus.SKIPPED, null);
    await this.checkRunCompletion(runId);
    return stop;
  }

  private async checkRunCompletion(runId: string): Promise<void> {
    const run = await this.getRun(runId);
    const allDone = run.stops.every(
      (s) => s.status === DeliveryStopStatus.COMPLETED || s.status === DeliveryStopStatus.SKIPPED,
    );
    if (allDone && run.status === DeliveryRunStatus.IN_PROGRESS) {
      run.status      = DeliveryRunStatus.COMPLETED;
      run.completedAt = new Date();
      await this.runRepo.save(run);
      this.gateway.emitRunStatusUpdate(runId, DeliveryRunStatus.COMPLETED);
      this.logger.log(`Delivery run ${runId} auto-completed`);
    }
  }

  // -------------------------------------------------------------------------
  // Driver Location
  // -------------------------------------------------------------------------

  async pushLocation(driverId: string, dto: PushLocationDto): Promise<DriverLocationEntity> {
    const ping = this.locationRepo.create({
      driverId,
      runId:    dto.runId ?? null,
      lat:      dto.lat,
      lon:      dto.lon,
      heading:  dto.heading  ?? null,
      speedKmh: dto.speedKmh ?? null,
    });
    const saved = await this.locationRepo.save(ping);

    // Update vehicle last known position
    let vehicleId: string | null = null;
    let orderIds: string[] = [];

    if (dto.runId) {
      const run = await this.runRepo.findOne({
        where: { id: dto.runId },
        relations: ['stops', 'stops.orderLine'],
      });

      if (run?.vehicleId) {
        vehicleId = run.vehicleId;
      }

      // Extract unique order IDs for buyer tracking rooms
      orderIds = Array.from(
        new Set(
          run?.stops
            ?.map((s) => s.orderLine?.orderId)
            .filter((id): id is string => !!id),
        ),
      );
    }

    if (!vehicleId) {
      const driverVehicle = await this.vehiclesService.findByDriverId(driverId);
      if (driverVehicle) {
        vehicleId = driverVehicle.id;
      }
    }

    if (vehicleId) {
      await this.vehiclesService.updatePosition(vehicleId, dto.lat, dto.lon);
    }

    // Broadcast dual-precision to subscribers (exact to admin, fuzzy to buyer)
    this.gateway.emitLocationUpdate(
      driverId,
      dto.lat,
      dto.lon,
      dto.heading ?? null,
      dto.runId,
      orderIds,
    );

    return saved;
  }

  async getLastLocation(runId: string): Promise<DriverLocationEntity | null> {
    return this.locationRepo.findOne({
      where: { runId },
      order: { recordedAt: 'DESC' },
    });
  }

  async getLatestDriverLocations(): Promise<
    Array<{
      driverId: string;
      driverName: string;
      driverPhone?: string | null;
      vehiclePlate?: string | null;
      vehicleType?: string | null;
      lat: number;
      lon: number;
      heading?: number | null;
      speedKmh?: number | null;
      recordedAt: Date;
    }>
  > {
    const results: Map<
      string,
      {
        driverId: string;
        driverName: string;
        driverPhone?: string | null;
        vehiclePlate?: string | null;
        vehicleType?: string | null;
        lat: number;
        lon: number;
        heading?: number | null;
        speedKmh?: number | null;
        recordedAt: Date;
      }
    > = new Map();

    // 1. Get latest locations from driver_locations table
    try {
      const latestPings = await this.locationRepo
        .createQueryBuilder('dl')
        .distinctOn(['dl.driverId'])
        .innerJoinAndSelect('dl.driver', 'driver')
        .orderBy('dl.driverId')
        .addOrderBy('dl.recordedAt', 'DESC')
        .getMany();

      for (const ping of latestPings) {
        if (ping.lat != null && ping.lon != null) {
          results.set(ping.driverId, {
            driverId: ping.driverId,
            driverName: ping.driver
              ? `${ping.driver.firstName} ${ping.driver.lastName}`.trim()
              : 'Chauffeur',
            driverPhone: ping.driver?.phoneNumber ?? null,
            vehiclePlate: null,
            vehicleType: null,
            lat: Number(ping.lat),
            lon: Number(ping.lon),
            heading: ping.heading != null ? Number(ping.heading) : null,
            speedKmh: ping.speedKmh != null ? Number(ping.speedKmh) : null,
            recordedAt: ping.recordedAt,
          });
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not query distinct driver_locations: ${(err as Error).message}`,
      );
    }

    // 2. Augment or fallback with active vehicles having lastKnownLat/Lon
    try {
      const vehicles = await this.vehiclesService.findAll();
      for (const v of vehicles) {
        if (v.currentDriverId && v.lastKnownLat != null && v.lastKnownLon != null) {
          const existing = results.get(v.currentDriverId);
          if (existing) {
            existing.vehiclePlate = v.registrationPlate;
            existing.vehicleType = v.type;
          } else {
            results.set(v.currentDriverId, {
              driverId: v.currentDriverId,
              driverName: v.currentDriver
                ? `${v.currentDriver.firstName} ${v.currentDriver.lastName}`.trim()
                : 'Chauffeur',
              driverPhone: v.currentDriver?.phoneNumber ?? null,
              vehiclePlate: v.registrationPlate,
              vehicleType: v.type,
              lat: Number(v.lastKnownLat),
              lon: Number(v.lastKnownLon),
              heading: null,
              speedKmh: null,
              recordedAt: v.lastSeenAt || new Date(),
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not augment driver locations with vehicles: ${(err as Error).message}`,
      );
    }

    return Array.from(results.values());
  }
}
