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
} from '@futurefarm/types';
import { DeliveryRunEntity } from './entities/delivery-run.entity';
import { DeliveryStopEntity } from './entities/delivery-stop.entity';
import { DriverLocationEntity } from './entities/driver-location.entity';
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { InspectionReportEntity } from '../inspections/entities/inspection-report.entity';
import {
  ROUTE_OPTIMIZER_PORT,
  RouteOptimizerPort,
  LatLon,
} from './interfaces/route-optimizer.port';
import { STORAGE_PORT, StoragePort } from './interfaces/storage.port';
import { VehiclesService } from './vehicles.service';
import { LogisticsGateway } from './logistics.gateway';

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
    @InjectRepository(InspectionReportEntity)
    private readonly inspectionReportRepo: Repository<InspectionReportEntity>,
    private readonly vehiclesService: VehiclesService,
    private readonly dataSource: DataSource,
    @Inject(ROUTE_OPTIMIZER_PORT)
    private readonly routeOptimizer: RouteOptimizerPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    // Gateway is injected lazily (forwardRef) to avoid circular dependency
    @Inject('LOGISTICS_GATEWAY')
    private readonly gateway: LogisticsGateway,
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

          const durationPerStopSec = optimised.totalDurationSec / stops.length;
          const baseTime = savedRun.scheduledAt.getTime();

          // Re-sequence stops according to optimised order and set ETA
          for (let idx = 0; idx < optimised.orderedWaypoints.length; idx++) {
            const wp    = optimised.orderedWaypoints[idx]!;
            const stop  = stops[wp.originalIndex]!;
            stop.sequence = idx;
            
            // ETA is scheduledAt + (idx + 1) * durationPerStopSec
            const stopEta = new Date(baseTime + (idx + 1) * durationPerStopSec * 1000);
            stop.eta = stopEta;
            
            await manager.save(DeliveryStopEntity, stop);
          }
        } catch (err) {
          this.logger.warn(`OSRM optimisation failed, keeping original order: ${(err as Error).message}`);
        }

        await manager.save(DeliveryRunEntity, savedRun);
      }

      return this.getRun(savedRun.id);
    });
  }

  async listAllRuns(page = 1, limit = 20): Promise<{ data: DeliveryRunEntity[]; total: number }> {
    const [data, total] = await this.runRepo.findAndCount({
      order:     { scheduledAt: 'DESC' },
      relations: ['driver', 'vehicle', 'stops'],
      skip:      (page - 1) * limit,
      take:      limit,
    });
    return { data, total };
  }

  async listMyRuns(driverId: string): Promise<DeliveryRunEntity[]> {
    return this.runRepo.find({
      where:     { driverId },
      order:     { scheduledAt: 'DESC' },
      relations: ['vehicle', 'stops'],
    });
  }

  async getRun(id: string): Promise<DeliveryRunEntity> {
    const run = await this.runRepo.findOne({
      where:     { id },
      relations: ['driver', 'vehicle', 'stops'],
    });
    if (!run) throw new NotFoundException(`Delivery run ${id} not found`);
    // Sort stops by sequence
    run.stops.sort((a, b) => a.sequence - b.sequence);
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

    const durationPerStopSec = optimised.totalDurationSec / pendingStops.length;
    const baseTime = run.scheduledAt.getTime();

    for (let idx = 0; idx < optimised.orderedWaypoints.length; idx++) {
      const wp   = optimised.orderedWaypoints[idx]!;
      const stop = pendingStops[wp.originalIndex]!;
      stop.sequence = idx;
      
      const stopEta = new Date(baseTime + (idx + 1) * durationPerStopSec * 1000);
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
   * Trigger AI pickup inspection for a COLLECTION stop.
   * The inspection report ID is stored on the stop.
   */
  async createPickupReport(
    runId:       string,
    stopId:      string,
    driverId:    string,
    reportId:    string,
  ): Promise<DeliveryStopEntity> {
    const run  = await this.getRun(runId);
    if (run.driverId !== driverId) {
      throw new ForbiddenException('You are not the assigned driver for this run');
    }
    const stop = await this.getStop(runId, stopId);
    if (stop.type !== DeliveryStopType.COLLECTION) {
      throw new BadRequestException('Pickup reports are only available on COLLECTION stops');
    }
    if (stop.status !== DeliveryStopStatus.ARRIVED) {
      throw new BadRequestException('Driver must arrive at stop before creating a pickup report');
    }

    // Verify report exists
    const report = await this.inspectionReportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException(`Inspection report ${reportId} not found`);

    stop.pickupReportId = reportId;
    return this.stopRepo.save(stop);
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

    // Gate: COLLECTION stops require an AI pickup report
    if (stop.type === DeliveryStopType.COLLECTION && !stop.pickupReportId) {
      throw new BadRequestException(
        'A pickup report must be generated before completing a COLLECTION stop',
      );
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
      runId:    dto.runId,
      lat:      dto.lat,
      lon:      dto.lon,
      heading:  dto.heading  ?? null,
      speedKmh: dto.speedKmh ?? null,
    });
    const saved = await this.locationRepo.save(ping);

    // Update vehicle last known position
    const run = await this.runRepo.findOne({ where: { id: dto.runId } });
    if (run?.vehicleId) {
      await this.vehiclesService.updatePosition(run.vehicleId, dto.lat, dto.lon);
    }

    // Broadcast to subscribers
    this.gateway.emitLocationUpdate(driverId, dto.lat, dto.lon, dto.heading ?? null);

    return saved;
  }

  async getLastLocation(runId: string): Promise<DriverLocationEntity | null> {
    return this.locationRepo.findOne({
      where: { runId },
      order: { recordedAt: 'DESC' },
    });
  }
}
