import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  CreateDeliveryRunDto,
  CreateDeliveryStopDto,
  DeliveryRunStatus,
  DeliveryStopType,
  DeliveryStopStatus,
  OrderLineStatus,
  PaymentStatus,
  PickupReportStatus,
  AddressableType,
} from '@futurefarm/types';
import { AddressEntity } from '../addresses/entities/address.entity';
import { DriverProfileEntity } from './entities/driver-profile.entity';
import { DeliveryRunEntity } from './entities/delivery-run.entity';
import { DeliveryStopEntity } from './entities/delivery-stop.entity';
import { DriverLocationEntity } from './entities/driver-location.entity';
import { VehicleEntity } from './entities/vehicle.entity';
import { PickupReportEntity } from './entities/pickup-report.entity';
import { DriverProfileService } from './driver-profile.service';
import { VehiclesService } from './vehicles.service';
import { LogisticsService } from './logistics.service';
import { VrpRouteOptimizer } from './vrp-route-optimizer';
import {
  ROUTE_OPTIMIZER_PORT,
  type RouteOptimizerPort,
  type LatLon,
  type OptimisedRoute,
} from './interfaces/route-optimizer.port';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderLineEntity } from '../orders/entities/order-line.entity';
import { LogisticsGateway } from './logistics.gateway';

export interface StopAddress {
  street: string;
  city: string;
  lat: number;
  lon: number;
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  // Rolling pointer per calendar day to ensure round-robin fairness across drivers
  private roundRobinIndex = 0;
  private lastResetDate = new Date().toDateString();

  // In-memory sequential queue fallback if Redis / Bull is not available
  private sequentialQueue: Promise<any> = Promise.resolve();

  constructor(
    @InjectRepository(DeliveryRunEntity)
    private readonly runRepo: Repository<DeliveryRunEntity>,
    @InjectRepository(DeliveryStopEntity)
    private readonly stopRepo: Repository<DeliveryStopEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    private readonly driverProfileService: DriverProfileService,
    private readonly vehiclesService: VehiclesService,
    @Inject(forwardRef(() => LogisticsService))
    private readonly logisticsService: LogisticsService,
    private readonly vrpOptimizer: VrpRouteOptimizer,
    @Inject(ROUTE_OPTIMIZER_PORT)
    private readonly routeOptimizer: RouteOptimizerPort,
    private readonly dataSource: DataSource,
    @Optional()
    @InjectQueue('order-dispatch')
    private readonly orderDispatchQueue?: Queue,
    @Optional()
    @Inject('LOGISTICS_GATEWAY')
    private readonly gateway?: LogisticsGateway,
  ) {}

  /**
   * Resets round-robin index at midnight.
   */
  private checkDailyReset(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.lastResetDate = today;
      this.roundRobinIndex = 0;
    }
  }

  /**
   * Enqueues an order for sequential delivery planning as soon as payment clears.
   */
  async queueOrderDispatch(orderId: string): Promise<void> {
    this.logger.log(`Enqueuing order dispatch calculation for order: ${orderId}`);

    if (this.orderDispatchQueue) {
      try {
        await this.orderDispatchQueue.add(
          { orderId },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
          },
        );
        return;
      } catch (err) {
        this.logger.warn(
          `Bull queue submission failed, using in-memory sequential fallback: ${(err as Error).message}`,
        );
      }
    }

    // In-memory sequential queue (FIFO chain) fallback
    this.sequentialQueue = this.sequentialQueue
      .then(() => this.processOrderDispatch(orderId))
      .catch((err) => {
        this.logger.error(
          `Sequential dispatch error for order ${orderId}: ${(err as Error).message}`,
        );
      });
  }

  /**
   * Main dispatch calculation pipeline:
   * 1. Extracts stops & required capacity.
   * 2. Tries route co-loading (merging into an existing PLANNED run today/tomorrow).
   * 3. If not merged, evaluates candidate driver schedules across rolling days (08:00 - 18:00).
   * 4. Packs schedules sequentially without overlapping and assigns driver.
   */
  async processOrderDispatch(orderId: string): Promise<DeliveryRunEntity | null> {
    this.logger.log(`Processing order dispatch for order ${orderId}`);

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: [
        'lines',
        'lines.harvest',
        'lines.harvest.parcel',
        'lines.harvest.product',
        'lines.farmerProfile',
        'lines.farmerProfile.parcels',
      ],
    });

    if (!order) {
      this.logger.warn(`Order ${orderId} not found for dispatch calculation`);
      return null;
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      this.logger.warn(`Order ${orderId} is not PAID. Skipping dispatch calculation.`);
      return null;
    }

    const activeLines = (order.lines || []).filter(
      (l) => l.status !== OrderLineStatus.REJECTED,
    );

    if (activeLines.length === 0) {
      this.logger.warn(`Order ${orderId} has no active lines. Skipping dispatch calculation.`);
      return null;
    }

    // Calculate total weight
    const totalWeightKg = activeLines.reduce(
      (acc, l) => acc + (Number(l.quantity) || 10),
      0,
    );

    // Build collection stops (one per farmer / parcel location)
    const farmerGroups = new Map<string, OrderLineEntity[]>();
    for (const line of activeLines) {
      const key = line.farmerProfileId || 'default-farmer';
      const existing = farmerGroups.get(key) || [];
      existing.push(line);
      farmerGroups.set(key, existing);
    }

    const collectionStops: CreateDeliveryStopDto[] = [];
    const addressRepo =
      typeof this.dataSource?.getRepository === 'function'
        ? this.dataSource.getRepository(AddressEntity)
        : null;

    for (const [, lines] of farmerGroups) {
      const primaryLine = lines[0]!;
      const farmer = primaryLine.farmerProfile;
      const parcel = primaryLine.harvest?.parcel || farmer?.parcels?.[0];

      let coords = this.parseCoordinates(
        parcel?.locationCoordinates,
        null,
      );

      if (!coords && farmer?.userId && addressRepo) {
        try {
          const farmerAddr = await addressRepo.findOne({
            where: { addressableType: AddressableType.USER, addressableId: farmer.userId },
            order: { isDefault: 'DESC', createdAt: 'DESC' },
          });
          if (farmerAddr?.latitude && farmerAddr?.longitude) {
            coords = { lat: Number(farmerAddr.latitude), lon: Number(farmerAddr.longitude) };
          }
        } catch (err) {
          this.logger.warn(`Failed to resolve farmer address coordinates: ${(err as Error).message}`);
        }
      }

      if (!coords) {
        coords = { lat: -4.3275, lon: 15.3136 }; // Kinshasa central default
      }

      const itemsDesc = lines
        .map((l) => `${l.quantity}kg ${l.harvest?.product?.name || 'récolte'}`)
        .join(', ');

      collectionStops.push({
        orderLineId: primaryLine.id,
        type: DeliveryStopType.COLLECTION,
        address: {
          street: farmer?.address || 'Ferme agricole',
          city: farmer?.regionName || 'Kinshasa',
          lat: coords.lat,
          lon: coords.lon,
        },
        notes: `Collecte : ${itemsDesc}`,
      });
    }

    // Build delivery stop (buyer's address)
    const buyerAddress = order.deliveryAddress;
    const buyerCoords = {
      lat: Number(buyerAddress?.latitude ?? (buyerAddress as any)?.lat ?? -4.325),
      lon: Number(buyerAddress?.longitude ?? (buyerAddress as any)?.lon ?? 15.322),
    };

    const deliveryStop: CreateDeliveryStopDto = {
      orderLineId: activeLines[0]!.id,
      type: DeliveryStopType.DELIVERY,
      address: {
        street: buyerAddress?.streetAddress || buyerAddress?.street || 'Adresse de livraison',
        city: buyerAddress?.city || 'Kinshasa',
        lat: buyerCoords.lat,
        lon: buyerCoords.lon,
      },
      notes: order.notes || `Livraison commande #${order.id.slice(0, 8)}`,
    };

    const allNewStops = [...collectionStops, deliveryStop];

    // -------------------------------------------------------------------------
    // Strategy 1: Attempt Route Co-loading / Merging into Existing Run
    // -------------------------------------------------------------------------
    const mergedRun = await this.tryMergeIntoExistingRun(
      allNewStops,
      totalWeightKg,
      order.id,
    );
    if (mergedRun) {
      this.logger.log(
        `Optimized transport: Order ${orderId} merged into existing run ${mergedRun.id}`,
      );
      return mergedRun;
    }

    // -------------------------------------------------------------------------
    // Strategy 2 & Rolling Horizon: Schedule New Run within Working Hours
    // -------------------------------------------------------------------------
    return this.scheduleNewDeliveryRun(
      allNewStops,
      totalWeightKg,
      order.id,
    );
  }

  /**
   * Strategy 1: Checks if any existing PLANNED run on today or tomorrow
   * has enough capacity and roughly the same itinerary to absorb the new stops.
   */
  /**
   * Strategy 1: Checks if any existing unstarted PLANNED run can absorb the new stops
   * according to logistics optimization criteria:
   * 1. Same farmer + Same buyer (identical route, 0 extra km)
   * 2. Same farmer + Nearby buyers (within 15km / same city)
   * 3. Same buyer + Nearby farmers (within 15km / same region)
   * 4. Shared corridor (both pickup & dropoff within 20km of existing stops)
   * Provided vehicle has remaining weight capacity.
   */
  private async tryMergeIntoExistingRun(
    newStops: CreateDeliveryStopDto[],
    newWeightKg: number,
    orderId: string,
  ): Promise<DeliveryRunEntity | null> {
    // Find all unstarted PLANNED runs (planned and not yet started by the driver)
    const plannedRuns = await this.runRepo.find({
      where: {
        status: DeliveryRunStatus.PLANNED,
      },
      relations: ['stops', 'vehicle', 'driver'],
      order: { scheduledAt: 'ASC' },
    });

    const unstartedRuns = plannedRuns.filter((r) => !r.startedAt);

    if (unstartedRuns.length === 0) {
      return null;
    }

    const getCoords = (addr: any) => ({
      lat: Number(addr?.lat ?? addr?.latitude ?? 0),
      lon: Number(addr?.lon ?? addr?.longitude ?? 0),
    });

    const getStopWeight = (s: DeliveryStopEntity): number => {
      if (s.notes) {
        const match = s.notes.match(/(\d+(?:\.\d+)?)\s*kg/i);
        if (match && match[1]) return parseFloat(match[1]);
      }
      return 10;
    };

    const newCollections = newStops.filter((s) => s.type === DeliveryStopType.COLLECTION);
    const newDeliveries = newStops.filter((s) => s.type === DeliveryStopType.DELIVERY);

    interface CandidateMatch {
      run: DeliveryRunEntity;
      matchScore: number;
      matchType: string;
    }

    const candidateMatches: CandidateMatch[] = [];

    for (const run of unstartedRuns) {
      const vehicleCapacity = Number(run.vehicle?.capacityKg) || 1000;

      // 1. Calculate actual existing load in the vehicle
      const existingCollections = (run.stops || []).filter(
        (s) => s.type === DeliveryStopType.COLLECTION && s.status !== DeliveryStopStatus.SKIPPED,
      );
      const existingDeliveries = (run.stops || []).filter(
        (s) => s.type === DeliveryStopType.DELIVERY && s.status !== DeliveryStopStatus.SKIPPED,
      );

      const currentRunWeightKg = existingCollections.reduce(
        (sum, s) => sum + getStopWeight(s),
        0,
      );

      // Check if vehicle has enough space for new cargo
      if (currentRunWeightKg + newWeightKg > vehicleCapacity) {
        this.logger.debug(
          `Run ${run.id} skipped for order ${orderId}: capacity exceeded (${currentRunWeightKg + newWeightKg}kg > ${vehicleCapacity}kg)`,
        );
        continue;
      }

      if (existingCollections.length === 0 && existingDeliveries.length === 0) {
        continue;
      }

      const existingCollectionCoords = existingCollections.map((s) => getCoords(s.address));
      const existingDeliveryCoords = existingDeliveries.map((s) => getCoords(s.address));

      // Criterion 1: Same Farmer & Same Buyer (exact corridor co-load)
      const isSameFarmer = newCollections.every((nc) => {
        const ncCoords = getCoords(nc.address);
        return existingCollectionCoords.some((ec) => this.haversineDistance(ncCoords, ec) < 0.5);
      });
      const isSameBuyer = newDeliveries.every((nd) => {
        const ndCoords = getCoords(nd.address);
        return existingDeliveryCoords.some((ed) => this.haversineDistance(ndCoords, ed) < 0.5);
      });

      if (isSameFarmer && isSameBuyer) {
        candidateMatches.push({
          run,
          matchScore: 1000,
          matchType: 'SAME_FARMER_SAME_BUYER',
        });
        continue;
      }

      // Criterion 2: Same Farmer, Different Buyers (Relatively Close <= 15 km)
      const isNearbyBuyer = newDeliveries.every((nd) => {
        const ndCoords = getCoords(nd.address);
        return existingDeliveryCoords.some((ed) => this.haversineDistance(ndCoords, ed) <= 15.0);
      });

      if (isSameFarmer && isNearbyBuyer) {
        candidateMatches.push({
          run,
          matchScore: 700,
          matchType: 'SAME_FARMER_NEARBY_BUYER',
        });
        continue;
      }

      // Criterion 3: Same Buyer, Different Farmers (Relatively Close <= 15 km)
      const isNearbyFarmer = newCollections.every((nc) => {
        const ncCoords = getCoords(nc.address);
        return existingCollectionCoords.some((ec) => this.haversineDistance(ncCoords, ec) <= 15.0);
      });

      if (isSameBuyer && isNearbyFarmer) {
        candidateMatches.push({
          run,
          matchScore: 700,
          matchType: 'SAME_BUYER_NEARBY_FARMER',
        });
        continue;
      }

      // Criterion 4: Shared Corridor / Nearby Farmer (<= 20km) and Nearby Buyer (<= 20km)
      const isCorridorFarmer = newCollections.every((nc) => {
        const ncCoords = getCoords(nc.address);
        return existingCollectionCoords.some((ec) => this.haversineDistance(ncCoords, ec) <= 20.0);
      });
      const isCorridorBuyer = newDeliveries.every((nd) => {
        const ndCoords = getCoords(nd.address);
        return existingDeliveryCoords.some((ed) => this.haversineDistance(ndCoords, ed) <= 20.0);
      });

      if (isCorridorFarmer && isCorridorBuyer) {
        candidateMatches.push({
          run,
          matchScore: 400,
          matchType: 'SHARED_CORRIDOR',
        });
        continue;
      }
    }

    if (candidateMatches.length === 0) {
      this.logger.debug(`No compatible unstarted run found to merge order ${orderId}`);
      return null;
    }

    // Sort by highest matchScore, then earliest scheduled time
    candidateMatches.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return new Date(a.run.scheduledAt).getTime() - new Date(b.run.scheduledAt).getTime();
    });

    for (const { run, matchScore, matchType } of candidateMatches) {
      const existingCollectionDtos: CreateDeliveryStopDto[] = (run.stops || [])
        .filter((s) => s.type === DeliveryStopType.COLLECTION && s.status !== DeliveryStopStatus.SKIPPED)
        .map((s) => ({
          orderLineId: s.orderLineId,
          type: s.type,
          address: s.address,
          ...(s.notes ? { notes: s.notes } : {}),
        }));

      const existingDeliveryDtos: CreateDeliveryStopDto[] = (run.stops || [])
        .filter((s) => s.type === DeliveryStopType.DELIVERY && s.status !== DeliveryStopStatus.SKIPPED)
        .map((s) => ({
          orderLineId: s.orderLineId,
          type: s.type,
          address: s.address,
          ...(s.notes ? { notes: s.notes } : {}),
        }));

      // Combined stops: enforce strictly all collection stops first, then all delivery stops
      const mergedCollectionDtos = [...existingCollectionDtos, ...newCollections];
      const mergedDeliveryDtos = [...existingDeliveryDtos, ...newDeliveries];
      const mergedStopDtos: CreateDeliveryStopDto[] = [
        ...mergedCollectionDtos,
        ...mergedDeliveryDtos,
      ];

      const waypoints: LatLon[] = mergedStopDtos.map((s, i) => {
        const c = getCoords(s.address);
        return {
          id: `stop-${i}`,
          lat: c.lat,
          lon: c.lon,
        };
      });

      try {
        let routeResult: OptimisedRoute;
        try {
          routeResult = await this.routeOptimizer.optimise(waypoints);
        } catch {
          // Graceful fallback: maintain collections then deliveries
          routeResult = {
            orderedWaypoints: waypoints.map((wp, i) => ({ ...wp, originalIndex: i })),
            totalDistanceKm: run.totalDistanceKm || 25,
            totalDurationSec: 2400,
          };
        }

        this.logger.log(
          `Co-loading match found: Merging order ${orderId} into run ${run.id} [${matchType}] (matchScore: ${matchScore})`,
        );

        // --- MERGE SUCCESSFUL: Apply merge inside a transaction ---
        return await this.dataSource.transaction(async (manager) => {
          // 1. Insert only new stops
          for (let i = 0; i < newStops.length; i++) {
            const ns = newStops[i]!;
            const stopEntity = manager.create(DeliveryStopEntity, {
              runId: run.id,
              orderLineId: ns.orderLineId,
              type: ns.type,
              sequence: (run.stops?.length || 0) + i,
              address: ns.address,
              notes: ns.notes ?? null,
              status: DeliveryStopStatus.PENDING,
            });
            const savedStop = await manager.save(DeliveryStopEntity, stopEntity);

            if (ns.type === DeliveryStopType.COLLECTION) {
              const report = manager.create(PickupReportEntity, {
                stopId: savedStop.id,
                driverId: run.driverId,
                orderLineId: ns.orderLineId,
                status: PickupReportStatus.PENDING,
              });
              const savedReport = await manager.save(PickupReportEntity, report);
              savedStop.pickupReportId = savedReport.id;
              await manager.save(DeliveryStopEntity, savedStop);
            }
          }

          // 2. Update run metadata
          run.optimisedRoute = (routeResult.orderedWaypoints || []) as unknown as object;
          if (routeResult.totalDistanceKm) {
            run.totalDistanceKm = Math.max(run.totalDistanceKm || 0, routeResult.totalDistanceKm);
          }
          run.notes = `${run.notes || ''} | Co-chargement #${orderId.slice(0, 8)}`.trim();
          const updatedRun = await manager.save(DeliveryRunEntity, run);

          // 3. Re-sequence all stops in the run ensuring Collections come before Deliveries
          const allStops = await manager.find(DeliveryStopEntity, {
            where: { runId: run.id },
          });

          // Separate collections and deliveries among all DB stops
          const dbCollections = allStops.filter((s) => s.type === DeliveryStopType.COLLECTION);
          const dbDeliveries = allStops.filter((s) => s.type === DeliveryStopType.DELIVERY);

          let currentSeq = 0;
          const baseTime = new Date(run.scheduledAt).getTime();

          for (const colStop of dbCollections) {
            colStop.sequence = currentSeq;
            colStop.eta = new Date(baseTime + currentSeq * 15 * 60 * 1000);
            await manager.save(DeliveryStopEntity, colStop);
            currentSeq++;
          }

          for (const delStop of dbDeliveries) {
            delStop.sequence = currentSeq;
            delStop.eta = new Date(baseTime + currentSeq * 20 * 60 * 1000);
            await manager.save(DeliveryStopEntity, delStop);
            currentSeq++;
          }

          this.gateway?.emitRunStatusUpdate(run.id, run.status);
          return updatedRun;
        });
      } catch (err) {
        this.logger.warn(`Co-loading route merge transaction failed: ${(err as Error).message}`);
      }
    }

    return null;
  }

  /**
   * Strategy 2 & Rolling Horizon: Schedules a new delivery run by evaluating
   * working hours (08:00 - 18:00) across candidate days (today, tomorrow, up to Day +3).
   */
  private async scheduleNewDeliveryRun(
    stops: CreateDeliveryStopDto[],
    totalWeightKg: number,
    orderId: string,
  ): Promise<DeliveryRunEntity> {
    const waypoints: LatLon[] = stops.map((s, i) => ({
      id: `stop-${i}`,
      lat: s.address.lat,
      lon: s.address.lon,
    }));

    let travelDurationSec = 1800; // 30 min default transit
    let distanceKm = 15;
    try {
      const route = await this.routeOptimizer.optimise(waypoints);
      travelDurationSec = route.totalDurationSec || 1800;
      distanceKm = route.totalDistanceKm || 15;
    } catch (e) {
      this.logger.warn(`OSRM calculation fallback: ${(e as Error).message}`);
    }
    this.logger.debug(`Calculated route distance: ${distanceKm} km`);

    const collectionCount = stops.filter((s) => s.type === DeliveryStopType.COLLECTION).length;
    const deliveryCount = stops.filter((s) => s.type === DeliveryStopType.DELIVERY).length;
    const serviceTimeSec = collectionCount * 20 * 60 + deliveryCount * 10 * 60;
    const totalRunDurationSec = travelDurationSec + serviceTimeSec;
    const totalRunDurationMs = totalRunDurationSec * 1000;

    const allAvailableDrivers = await this.driverProfileService.listAvailableProfiles();
    const allVehicles = await this.vehiclesService.listAvailable();

    // Look across 4 rolling days (Day 0 = Today up to Day 3)
    const now = new Date();

    for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
      const candidateDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);

      // Define shift boundaries: 08:00 to 18:00
      const shiftStart = new Date(candidateDate);
      shiftStart.setHours(8, 0, 0, 0);

      const shiftEnd = new Date(candidateDate);
      shiftEnd.setHours(18, 0, 0, 0);

      // If candidate day is today, shiftStart cannot be earlier than current time
      const effectiveShiftStart =
        dayOffset === 0 && now.getTime() > shiftStart.getTime()
          ? new Date(now.getTime() + 10 * 60 * 1000) // 10 min prep buffer
          : shiftStart;

      // If the run itself would exceed 18:00 even if started immediately, roll to next day
      if (effectiveShiftStart.getTime() + totalRunDurationMs > shiftEnd.getTime()) {
        continue; // Try next day
      }

      // Check candidate drivers who can take this run on candidateDate
      interface DriverSlotOption {
        driver: DriverProfileEntity;
        vehicle?: VehicleEntity | undefined;
        startTime: Date;
        proximityScore: number;
      }

      const viableOptions: DriverSlotOption[] = [];

      for (const driver of allAvailableDrivers) {
        // Vehicle check
        const vehicle =
          allVehicles.find((v) => v.currentDriverId === driver.userId) ||
          allVehicles.find((v) => !v.currentDriverId && Number(v.capacityKg) >= totalWeightKg);

        if (vehicle && Number(vehicle.capacityKg) < totalWeightKg) {
          continue; // Vehicle too small
        }

        // Get driver's existing runs on this calendar day
        const dayStart = new Date(candidateDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(candidateDate);
        dayEnd.setHours(23, 59, 59, 999);

        const existingRuns = await this.runRepo.find({
          where: {
            driverId: driver.userId,
            scheduledAt: Between(dayStart, dayEnd),
          },
          relations: ['stops'],
          order: { scheduledAt: 'ASC' },
        });

        // Determine earliest available time for this driver
        let driverAvailableAt = effectiveShiftStart.getTime();

        if (existingRuns.length > 0) {
          // Compute completion of the driver's last run (+15 min buffer between runs)
          let latestRunEndTime = driverAvailableAt;
          for (const r of existingRuns) {
            const rStart = new Date(r.scheduledAt).getTime();
            // Estimate prior run duration
            const rStops = r.stops?.length || 2;
            const rDurationSec = (r.totalDistanceKm ? (r.totalDistanceKm / 30) * 3600 : 1800) + rStops * 15 * 60;
            const rEnd = rStart + rDurationSec * 1000;
            if (rEnd > latestRunEndTime) {
              latestRunEndTime = rEnd;
            }
          }
          driverAvailableAt = Math.max(
            driverAvailableAt,
            latestRunEndTime + 15 * 60 * 1000, // 15 min turnaround buffer
          );
        }

        // Check if run can finish before 18:00
        if (driverAvailableAt + totalRunDurationMs <= shiftEnd.getTime()) {
          // Driver chaining score: measure distance between driver's last stop (or vehicle location) and first collection
          let proximityScore = 0;
          const firstCollection = stops[0]?.address;
          if (firstCollection) {
            if (existingRuns.length > 0) {
              const lastRun = existingRuns[existingRuns.length - 1]!;
              const lastStop = lastRun.stops?.[lastRun.stops.length - 1]?.address;
              if (lastStop) {
                proximityScore = this.haversineDistance(
                  { lat: lastStop.lat, lon: lastStop.lon },
                  { lat: firstCollection.lat, lon: firstCollection.lon },
                );
              }
            } else if (vehicle?.lastKnownLat && vehicle?.lastKnownLon) {
              proximityScore = this.haversineDistance(
                { lat: vehicle.lastKnownLat, lon: vehicle.lastKnownLon },
                { lat: firstCollection.lat, lon: firstCollection.lon },
              );
            } else {
              const locationRepo =
                typeof this.dataSource?.getRepository === 'function'
                  ? this.dataSource.getRepository(DriverLocationEntity)
                  : null;
              const lastPing = locationRepo
                ? await locationRepo.findOne({
                    where: { driverId: driver.userId },
                    order: { recordedAt: 'DESC' },
                  })
                : null;
              if (lastPing?.lat && lastPing?.lon) {
                proximityScore = this.haversineDistance(
                  { lat: Number(lastPing.lat), lon: Number(lastPing.lon) },
                  { lat: firstCollection.lat, lon: firstCollection.lon },
                );
              }
            }
          }

          viableOptions.push({
            driver,
            vehicle,
            startTime: new Date(driverAvailableAt),
            proximityScore,
          });
        }
      }

      if (viableOptions.length > 0) {
        // Sort viable options: prioritize earliest start time, then best proximity (driver chaining)
        viableOptions.sort((a, b) => {
          const timeDiff = a.startTime.getTime() - b.startTime.getTime();
          if (timeDiff !== 0) return timeDiff;
          return a.proximityScore - b.proximityScore;
        });

        const selected = viableOptions[0]!;

        this.logger.log(
          `Scheduling run on ${candidateDate.toISOString().slice(0, 10)} at ${selected.startTime.toISOString()} with driver ${selected.driver.userId}`,
        );

        const runPayload: CreateDeliveryRunDto = {
          scheduledAt: selected.startTime.toISOString(),
          notes: `Tournée planifiée pour la commande #${orderId.slice(0, 8)}`,
          stops,
        };
        if (selected.driver.userId) runPayload.driverId = selected.driver.userId;
        if (selected.vehicle?.id) runPayload.vehicleId = selected.vehicle.id;

        return this.logisticsService.createRun(runPayload);
      }
    }

    // Fallback if all 4 days are heavily booked: schedule for Day +3 at 08:00 with default driver
    const fallbackDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 8, 0, 0);
    this.logger.warn(
      `All slots within 3 days fully booked for order ${orderId}. Assigning to fallback slot on ${fallbackDate.toISOString()}`,
    );

    const fallbackDriver = allAvailableDrivers[0];
    const fallbackVehicle = allVehicles[0];

    const fallbackPayload: CreateDeliveryRunDto = {
      scheduledAt: fallbackDate.toISOString(),
      notes: `Tournée programmée sous forte charge (commande #${orderId.slice(0, 8)})`,
      stops,
    };
    if (fallbackDriver?.userId) fallbackPayload.driverId = fallbackDriver.userId;
    if (fallbackVehicle?.id) fallbackPayload.vehicleId = fallbackVehicle.id;

    return this.logisticsService.createRun(fallbackPayload);
  }

  /**
   * Recalculates route if a farmer rejects part or all of the order.
   * If all collections are rejected, the delivery run is cancelled and the driver is freed.
   */
  async recalculateForRejectedLine(
    orderId: string,
    rejectedLineId: string,
  ): Promise<DeliveryRunEntity | null> {
    this.logger.log(`Recalculating route for rejected line ${rejectedLineId} in order ${orderId}`);

    // Find the delivery stop associated with the rejected line
    const stop = await this.stopRepo.findOne({
      where: { orderLineId: rejectedLineId },
      relations: ['run'],
    });

    if (!stop || !stop.runId) {
      this.logger.log(`No active delivery stop found for line ${rejectedLineId}`);
      return null;
    }

    const runId = stop.runId;

    // Mark the stop as SKIPPED
    stop.status = DeliveryStopStatus.SKIPPED;
    stop.notes = `${stop.notes || ''} [Ligne annulée par le producteur]`.trim();
    await this.stopRepo.save(stop);

    // Fetch all stops for this run
    const allStops = await this.stopRepo.find({
      where: { runId },
      order: { sequence: 'ASC' },
    });

    const activeCollectionStops = allStops.filter(
      (s) => s.type === DeliveryStopType.COLLECTION && s.status !== DeliveryStopStatus.SKIPPED,
    );

    const run = await this.runRepo.findOne({
      where: { id: runId },
    });
    if (!run) return null;

    // If NO collection stops remain active, cancel the delivery run entirely
    if (activeCollectionStops.length === 0) {
      this.logger.warn(
        `All collection stops for run ${runId} have been rejected. Cancelling delivery run.`,
      );
      run.status = DeliveryRunStatus.CANCELLED;
      run.notes = `${run.notes || ''} [Annulée: toutes les récoltes ont été rejetées]`.trim();
      const cancelledRun = await this.runRepo.save(run);
      this.gateway?.emitRunStatusUpdate(run.id, run.status);
      return cancelledRun;
    }

    // Otherwise, re-sequence the remaining active stops
    const activeStops = allStops.filter((s) => s.status !== DeliveryStopStatus.SKIPPED);
    const waypoints: LatLon[] = activeStops.map((s) => ({
      id: s.id,
      lat: Number(s.address.lat),
      lon: Number(s.address.lon),
    }));

    try {
      const optimised = await this.routeOptimizer.optimise(waypoints);
      run.optimisedRoute = optimised.orderedWaypoints as unknown as object;
      run.totalDistanceKm = optimised.totalDistanceKm;
      const updatedRun = await this.runRepo.save(run);

      const baseTime = run.scheduledAt.getTime();
      const offsets = optimised.durationOffsetPerStop || {};

      for (const item of optimised.orderedWaypoints) {
        const targetStop = activeStops[item.originalIndex];
        if (targetStop) {
          targetStop.sequence = item.originalIndex;
          const transitOffsetSec = offsets[item.originalIndex] || 0;
          targetStop.eta = new Date(baseTime + transitOffsetSec * 1000);
          await this.stopRepo.save(targetStop);
        }
      }

      this.gateway?.emitRunStatusUpdate(run.id, run.status);
      return updatedRun;
    } catch (err) {
      this.logger.warn(`Failed to re-optimize run ${runId} after rejection: ${(err as Error).message}`);
      return run;
    }
  }

  /**
   * Selects the best driver using:
   * 1. Available drivers (isAvailable=true, no active IN_PROGRESS run)
   * 2. Vehicle capacity >= required weight
   * 3. Proximity to first collection stop
   * 4. Strict round-robin distribution to prevent repeatedly assigning the same driver
   */
  async findBestDriver(
    run: DeliveryRunEntity,
    requiredCapacityKg = 50,
    excludedDriverIds: string[] = [],
  ): Promise<{ driver: DriverProfileEntity; vehicle?: VehicleEntity | undefined } | null> {
    this.checkDailyReset();

    const allAvailable = await this.driverProfileService.listAvailableProfiles();
    if (allAvailable.length === 0) return null;

    const candidateDrivers = allAvailable.filter(
      (d) => !excludedDriverIds.includes(d.userId),
    );
    if (candidateDrivers.length === 0) return null;

    const inProgressRuns = await this.runRepo.find({
      where: { status: DeliveryRunStatus.IN_PROGRESS },
    });
    const busyDriverIds = new Set(inProgressRuns.map((r) => r.driverId).filter(Boolean));

    const idleDrivers = candidateDrivers.filter((d) => !busyDriverIds.has(d.userId));
    if (idleDrivers.length === 0) return null;

    const allVehicles = await this.vehiclesService.listAvailable();

    interface ScoredCandidate {
      driver: DriverProfileEntity;
      vehicle?: VehicleEntity | undefined;
      distanceKm: number;
    }

    const validCandidates: ScoredCandidate[] = [];
    const firstStop = run.stops?.[0]?.address;

    for (const driver of idleDrivers) {
      const vehicle =
        allVehicles.find((v) => v.currentDriverId === driver.userId) ||
        allVehicles.find((v) => !v.currentDriverId && Number(v.capacityKg) >= requiredCapacityKg);

      if (vehicle && Number(vehicle.capacityKg) < requiredCapacityKg) {
        continue;
      }

      let distanceKm = 0;
      if (firstStop && vehicle?.lastKnownLat && vehicle?.lastKnownLon) {
        distanceKm = this.haversineDistance(
          { lat: vehicle.lastKnownLat, lon: vehicle.lastKnownLon },
          { lat: firstStop.lat, lon: firstStop.lon },
        );
      } else if (firstStop) {
        const locationRepo =
          typeof this.dataSource?.getRepository === 'function'
            ? this.dataSource.getRepository(DriverLocationEntity)
            : null;
        const lastPing = locationRepo
          ? await locationRepo.findOne({
              where: { driverId: driver.userId },
              order: { recordedAt: 'DESC' },
            })
          : null;
        if (lastPing?.lat && lastPing?.lon) {
          distanceKm = this.haversineDistance(
            { lat: Number(lastPing.lat), lon: Number(lastPing.lon) },
            { lat: firstStop.lat, lon: firstStop.lon },
          );
        }
      }

      validCandidates.push({ driver, vehicle, distanceKm });
    }

    if (validCandidates.length === 0) {
      return { driver: idleDrivers[0]! };
    }

    validCandidates.sort((a, b) => a.distanceKm - b.distanceKm);

    const selectedIdx = this.roundRobinIndex % validCandidates.length;
    this.roundRobinIndex++;

    const chosen = validCandidates[selectedIdx]!;
    this.logger.log(
      `Round-robin dispatch selected driver ${chosen.driver.userId} (index ${selectedIdx}/${validCandidates.length}) for run ${run.id}`,
    );

    return { driver: chosen.driver, vehicle: chosen.vehicle };
  }

  /**
   * Plans runs using CVRP (Clarke-Wright savings + capacity + collinearity)
   * and dispatches each resulting run with round-robin fairness.
   */
  async planAndDispatch(dto: CreateDeliveryRunDto): Promise<DeliveryRunEntity[]> {
    const collectionStops = dto.stops.filter((s) => s.type === DeliveryStopType.COLLECTION);
    const deliveryStops = dto.stops.filter((s) => s.type === DeliveryStopType.DELIVERY);

    const availableVehicles = await this.vehiclesService.listAvailable();

    const routeGroups = await this.vrpOptimizer.partition(
      collectionStops,
      deliveryStops,
      availableVehicles,
    );

    this.logger.log(`VRP Partitioning produced ${routeGroups.length} delivery run(s)`);

    const createdRuns: DeliveryRunEntity[] = [];

    for (const group of routeGroups) {
      const runPayload: CreateDeliveryRunDto = {
        ...dto,
        stops: group.stops,
      };
      if (group.assignedVehicle?.id) {
        runPayload.vehicleId = group.assignedVehicle.id;
      }
      delete runPayload.driverId;

      const run = await this.logisticsService.createRun(runPayload);

      try {
        const dispatched = await this.autoDispatch(run.id, group.totalWeightKg);
        createdRuns.push(dispatched);
      } catch (err) {
        this.logger.warn(`Auto-dispatch failed for run ${run.id}: ${(err as Error).message}`);
        createdRuns.push(run);
      }
    }

    return createdRuns;
  }

  /**
   * Automatically dispatches an eligible driver to a planned run.
   */
  async autoDispatch(
    runId: string,
    requiredCapacityKg = 50,
    excludedDriverIds: string[] = [],
  ): Promise<DeliveryRunEntity> {
    const run = await this.logisticsService.getRun(runId);
    if (run.status !== DeliveryRunStatus.PLANNED) {
      throw new BadRequestException('Cannot auto-dispatch a run that is not PLANNED');
    }

    const selection = await this.findBestDriver(run, requiredCapacityKg, excludedDriverIds);
    if (!selection) {
      throw new NotFoundException('No available driver found matching constraints');
    }

    if (selection.vehicle && !run.vehicleId) {
      await this.logisticsService.assignVehicle(runId, selection.vehicle.id);
    }

    return this.logisticsService.assignDriver(runId, selection.driver.userId);
  }

  /**
   * Handles driver rejection or 30s countdown timeout:
   * 1. Unassigns current driver
   * 2. Re-runs autoDispatch excluding the rejecting driver
   */
  async rejectDispatch(runId: string, driverId: string): Promise<DeliveryRunEntity> {
    const run = await this.logisticsService.getRun(runId);
    if (run.driverId !== driverId) {
      throw new BadRequestException('You are not the currently assigned driver for this run');
    }

    this.logger.warn(`Driver ${driverId} rejected or timed out on run ${runId}. Re-dispatching...`);

    await this.logisticsService.unassignDriver(runId);

    try {
      return await this.autoDispatch(runId, 50, [driverId]);
    } catch (err) {
      this.logger.warn(`No alternate driver found for run ${runId}: ${(err as Error).message}`);
      return this.logisticsService.getRun(runId);
    }
  }

  private parseCoordinates(
    coordStr?: string | null,
    fallback: { lat: number; lon: number } | null = { lat: -4.3275, lon: 15.3136 },
  ): { lat: number; lon: number } | null {
    if (coordStr) {
      const parts = coordStr.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
        return { lat: parts[0]!, lon: parts[1]! };
      }
    }
    return fallback;
  }

  private haversineDistance(
    p1: { lat: number; lon: number },
    p2: { lat: number; lon: number },
  ): number {
    const R = 6371;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return +(R * c).toFixed(2);
  }
}
