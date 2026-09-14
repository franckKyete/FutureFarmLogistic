import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface LatLon {
  lat: number;
  lon: number;
  /** Optional label / stop ID for reference */
  id?: string;
}

export interface OptimisedRoute {
  /** Waypoints in the optimised visit order */
  orderedWaypoints: (LatLon & { originalIndex: number })[];
  /** Total route distance in kilometres */
  totalDistanceKm: number;
  /** Total estimated travel duration in seconds */
  totalDurationSec: number;
  /** Cumulative travel duration offset in seconds from start for each sequenced stop */
  durationOffsetPerStop?: Record<number, number>;
}

/** Token used to inject a RouteOptimizerPort */
export const ROUTE_OPTIMIZER_PORT = 'RouteOptimizerPort';

export interface RouteOptimizerPort {
  /**
   * Given an ordered list of waypoints, returns the optimised visit sequence
   * and metadata (distance, duration).
   */
  optimise(waypoints: LatLon[]): Promise<OptimisedRoute>;

  /**
   * Computes an NxN distance matrix (in km) across the provided waypoints.
   */
  table(waypoints: LatLon[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// OSRM implementation
// ---------------------------------------------------------------------------

/**
 * Uses the public OSRM `trip` API (router.project-osrm.org) to optimise
 * a multi-stop route.  No API key required.  Suitable for v1.
 */
@Injectable()
export class OsrmRouteOptimizer implements RouteOptimizerPort {
  private readonly logger = new Logger(OsrmRouteOptimizer.name);
  private readonly baseUrl = 'https://router.project-osrm.org';

  async optimise(waypoints: LatLon[]): Promise<OptimisedRoute> {
    if (waypoints.length < 2) {
      // Single waypoint — nothing to optimise
      return {
        orderedWaypoints: waypoints.map((wp, i) => ({ ...wp, originalIndex: i })),
        totalDistanceKm: 0,
        totalDurationSec: 0,
      };
    }

    const coords = waypoints
      .map((wp) => `${wp.lon},${wp.lat}`)
      .join(';');

    const url =
      `${this.baseUrl}/trip/v1/driving/${coords}` +
      `?roundtrip=false&source=first&destination=last&overview=false&steps=false`;

    this.logger.debug(`OSRM request: ${url}`);

    const raw = await this.get(url);
    const body = JSON.parse(raw) as OsrmTripResponse;

    if (body.code !== 'Ok' || !body.trips?.length) {
      this.logger.warn(`OSRM returned non-Ok code: ${body.code}`);
      // Graceful fallback: return original order
      return {
        orderedWaypoints: waypoints.map((wp, i) => ({ ...wp, originalIndex: i })),
        totalDistanceKm: 0,
        totalDurationSec: 0,
      };
    }

    const trip = body.trips[0];
    if (!trip) {
      return {
        orderedWaypoints: waypoints.map((wp, i) => ({ ...wp, originalIndex: i })),
        totalDistanceKm: 0,
        totalDurationSec: 0,
      };
    }

    // body.waypoints in OSRM /trip response gives the stops along the trip in the order they appear.
    // Each element in body.waypoints has:
    // - waypoint_index: The index of the waypoint along the calculated trip (0, 1, 2, ...).
    // - hint/location: Corresponds to the input coordinates in order of appearance in body.waypoints array.
    // We sort by waypoint_index to get the sequence along the trip, and map to original index.
    const waypointOrder: number[] = new Array(waypoints.length);
    for (let originalIndex = 0; originalIndex < body.waypoints.length; originalIndex++) {
      const wp = body.waypoints[originalIndex]!;
      const tripIndex = wp.waypoint_index;
      if (tripIndex >= 0 && tripIndex < waypoints.length) {
        waypointOrder[tripIndex] = originalIndex;
      }
    }

    // Fallback in case indices are missing or corrupt
    const validOrder = waypointOrder.every((idx) => typeof idx === 'number')
      ? waypointOrder
      : waypoints.map((_, i) => i);

    const orderedWaypoints = validOrder.map((originalIndex) => {
      const wp = waypoints[originalIndex]!;
      const result: LatLon & { originalIndex: number } = {
        lat: wp.lat,
        lon: wp.lon,
        originalIndex,
      };
      if (wp.id !== undefined) {
        result.id = wp.id;
      }
      return result;
    });

    const durationOffsetPerStop: Record<number, number> = {};
    let cumulativeDuration = 0;
    durationOffsetPerStop[0] = 0;

    if (trip.legs && trip.legs.length > 0) {
      for (let i = 0; i < trip.legs.length; i++) {
        cumulativeDuration += trip.legs[i]!.duration;
        durationOffsetPerStop[i + 1] = Math.round(cumulativeDuration);
      }
    } else {
      const avgDuration = trip.duration / (orderedWaypoints.length - 1 || 1);
      for (let i = 1; i < orderedWaypoints.length; i++) {
        durationOffsetPerStop[i] = Math.round(i * avgDuration);
      }
    }

    return {
      orderedWaypoints,
      totalDistanceKm: +(trip.distance / 1000).toFixed(2),
      totalDurationSec: Math.round(trip.duration),
      durationOffsetPerStop,
    };
  }

  async table(waypoints: LatLon[]): Promise<number[][]> {
    const n = waypoints.length;
    if (n === 0) return [];
    if (n === 1) return [[0]];

    const coords = waypoints.map((wp) => `${wp.lon},${wp.lat}`).join(';');
    const url = `${this.baseUrl}/table/v1/driving/${coords}?annotations=distance`;

    try {
      this.logger.debug(`OSRM table request: ${url}`);
      const raw = await this.get(url);
      const body = JSON.parse(raw) as { code: string; distances?: number[][] };

      if (body.code === 'Ok' && body.distances && body.distances.length === n) {
        // Convert meters to kilometers
        return body.distances.map((row) => row.map((d) => +(d / 1000).toFixed(2)));
      }
    } catch (err) {
      this.logger.warn(`OSRM table failed, falling back to Haversine: ${(err as Error).message}`);
    }

    // Fallback: Haversine distance matrix in km
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i]![j] = 0;
        } else {
          matrix[i]![j] = +this.haversineDistanceKm(waypoints[i]!, waypoints[j]!).toFixed(2);
        }
      }
    }
    return matrix;
  }

  private haversineDistanceKm(p1: LatLon, p2: LatLon): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private get(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get(url, { headers: { 'User-Agent': 'FutureFarm-Logistics/1.0' } }, (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => resolve(data));
        })
        .on('error', reject);
    });
  }
}

// ---------------------------------------------------------------------------
// OSRM response shape (subset)
// ---------------------------------------------------------------------------

interface OsrmTripResponse {
  code: string;
  trips: Array<{
    distance: number;
    duration: number;
    legs?: Array<{ distance: number; duration: number }>;
  }>;
  waypoints: Array<{
    waypoint_index: number;
    trips_index?: number;
  }>;
}
