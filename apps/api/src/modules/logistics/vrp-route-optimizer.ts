import { Injectable, Inject } from '@nestjs/common';
import {
  ROUTE_OPTIMIZER_PORT,
  type RouteOptimizerPort,
  type LatLon,
} from './interfaces/route-optimizer.port';
import { VehicleEntity } from './entities/vehicle.entity';
import { CreateDeliveryStopDto } from '@futurefarm/types';

export interface StopWithWeight extends LatLon {
  originalStop: CreateDeliveryStopDto;
  weightKg: number;
}

export interface RouteGroup {
  stops: CreateDeliveryStopDto[];
  totalWeightKg: number;
  assignedVehicle?: VehicleEntity | undefined;
}

@Injectable()
export class VrpRouteOptimizer {

  constructor(
    @Inject(ROUTE_OPTIMIZER_PORT)
    private readonly routeOptimizer: RouteOptimizerPort,
  ) {}

  /**
   * Partitions collection stops and returns optimal route groups
   * taking into account vehicle capacities, Clarke-Wright savings,
   * collinearity to buyer destination, and detour limits.
   */
  async partition(
    collectionStops: CreateDeliveryStopDto[],
    deliveryStops: CreateDeliveryStopDto[],
    availableVehicles: VehicleEntity[],
    defaultWeights?: Record<string, number>,
  ): Promise<RouteGroup[]> {
    if (collectionStops.length === 0) {
      return [
        {
          stops: [...deliveryStops],
          totalWeightKg: 0,
        },
      ];
    }

    // Default destination is the primary delivery address
    const destination: LatLon = deliveryStops[0]?.address
      ? { lat: deliveryStops[0].address.lat, lon: deliveryStops[0].address.lon }
      : { lat: 0, lon: 0 };

    // Map collection stops with estimated weights (defaulting to 50kg if not specified)
    const stopsWithWeight: StopWithWeight[] = collectionStops.map((s, idx) => ({
      id: s.orderLineId || `stop-${idx}`,
      lat: s.address.lat,
      lon: s.address.lon,
      weightKg: defaultWeights?.[s.orderLineId] ?? 50,
      originalStop: s,
    }));

    if (stopsWithWeight.length === 1 || availableVehicles.length <= 1) {
      // Single stop or single/no vehicle: keep in one route
      const totalWeight = stopsWithWeight.reduce((acc, s) => acc + s.weightKg, 0);
      return [
        {
          stops: [...collectionStops, ...deliveryStops],
          totalWeightKg: totalWeight,
          assignedVehicle: availableVehicles[0],
        },
      ];
    }

    // 1. Fetch distance matrix via OSRM /table (all collection stops + delivery destination)
    const waypoints: LatLon[] = [...stopsWithWeight, destination];
    const matrix = await this.routeOptimizer.table(waypoints);
    const destIdx = stopsWithWeight.length;

    // 2. Compute Clarke-Wright savings: S_ij = d(dest, i) + d(dest, j) - d(i, j)
    interface SavingPair {
      i: number;
      j: number;
      saving: number;
    }

    const savings: SavingPair[] = [];
    for (let i = 0; i < stopsWithWeight.length; i++) {
      for (let j = i + 1; j < stopsWithWeight.length; j++) {
        const d_i_dest = matrix[i]?.[destIdx] ?? 0;
        const d_j_dest = matrix[j]?.[destIdx] ?? 0;
        const d_ij = matrix[i]?.[j] ?? 0;
        const saving = d_i_dest + d_j_dest - d_ij;
        savings.push({ i, j, saving });
      }
    }

    // Sort descending by savings
    savings.sort((a, b) => b.saving - a.saving);

    // Initial state: Each stop is in its own route
    let activeRoutes: Array<{
      stops: StopWithWeight[];
      totalWeight: number;
    }> = stopsWithWeight.map((s) => ({
      stops: [s],
      totalWeight: s.weightKg,
    }));

    // Find max vehicle capacity available
    const maxCapacity = Math.max(...availableVehicles.map((v) => Number(v.capacityKg) || 1000), 1000);

    // 3. Greedy merge with capacity, collinearity, and detour ratio checks
    for (const { i, j } of savings) {
      const stopI = stopsWithWeight[i]!;
      const stopJ = stopsWithWeight[j]!;

      const routeI = activeRoutes.find((r) => r.stops.includes(stopI));
      const routeJ = activeRoutes.find((r) => r.stops.includes(stopJ));

      if (!routeI || !routeJ || routeI === routeJ) continue;

      const mergedWeight = routeI.totalWeight + routeJ.totalWeight;
      if (mergedWeight > maxCapacity) continue;

      // Collinearity check: Angle between centroids of both routes towards destination <= 45 deg
      const isCollinear = this.isCollinear(routeI.stops, routeJ.stops, destination);
      if (!isCollinear) continue;

      // Detour ratio check: merged direct distance vs individual direct distance <= 1.3
      const detourOk = this.checkDetour(routeI.stops, routeJ.stops, destination, matrix, stopsWithWeight);
      if (!detourOk) continue;

      // Merge routeJ into routeI
      routeI.stops.push(...routeJ.stops);
      routeI.totalWeight = mergedWeight;
      activeRoutes = activeRoutes.filter((r) => r !== routeJ);
    }

    // Map back to RouteGroup format, attaching delivery stops to each run
    return activeRoutes.map((r) => {
      const bestVehicle = this.pickBestFitVehicle(r.totalWeight, availableVehicles);
      return {
        stops: [...r.stops.map((s) => s.originalStop), ...deliveryStops],
        totalWeightKg: r.totalWeight,
        assignedVehicle: bestVehicle,
      };
    });
  }

  private isCollinear(groupA: StopWithWeight[], groupB: StopWithWeight[], dest: LatLon): boolean {
    const cA = this.centroid(groupA);
    const cB = this.centroid(groupB);

    const vA = { lat: dest.lat - cA.lat, lon: dest.lon - cA.lon };
    const vB = { lat: dest.lat - cB.lat, lon: dest.lon - cB.lon };

    const dot = vA.lat * vB.lat + vA.lon * vB.lon;
    const magA = Math.hypot(vA.lat, vA.lon);
    const magB = Math.hypot(vB.lat, vB.lon);

    if (magA === 0 || magB === 0) return true;
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
    const angleRad = Math.acos(cosAngle);

    // Accept if angle deviation <= 45 degrees (PI / 4)
    return angleRad <= Math.PI / 4;
  }

  private checkDetour(
    groupA: StopWithWeight[],
    groupB: StopWithWeight[],
    _dest: LatLon,
    matrix: number[][],
    allStops: StopWithWeight[],
  ): boolean {
    const lastA = groupA[groupA.length - 1]!;
    const firstB = groupB[0]!;

    const idxLastA = allStops.indexOf(lastA);
    const idxFirstB = allStops.indexOf(firstB);
    const destIdx = allStops.length;

    if (idxLastA === -1 || idxFirstB === -1) return true;

    const directDistA = matrix[idxLastA]?.[destIdx] ?? 1;
    const directDistB = matrix[idxFirstB]?.[destIdx] ?? 1;
    const bridgeDist = matrix[idxLastA]?.[idxFirstB] ?? 1;

    const directSum = directDistA + directDistB;
    const combinedPath = directDistA + bridgeDist;

    return directSum > 0 ? combinedPath / directSum <= 1.3 : true;
  }

  private centroid(stops: LatLon[]): LatLon {
    if (stops.length === 0) return { lat: 0, lon: 0 };
    const sum = stops.reduce(
      (acc, s) => ({ lat: acc.lat + s.lat, lon: acc.lon + s.lon }),
      { lat: 0, lon: 0 },
    );
    return {
      lat: sum.lat / stops.length,
      lon: sum.lon / stops.length,
    };
  }

  private pickBestFitVehicle(
    weightKg: number,
    availableVehicles: VehicleEntity[],
  ): VehicleEntity | undefined {
    // Find smallest vehicle that can handle the weight
    const fitting = availableVehicles
      .filter((v) => Number(v.capacityKg) >= weightKg)
      .sort((a, b) => Number(a.capacityKg) - Number(b.capacityKg));

    return fitting[0] || availableVehicles[0];
  }
}
