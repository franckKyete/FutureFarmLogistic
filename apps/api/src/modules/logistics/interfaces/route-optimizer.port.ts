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

    const waypointOrder = body.waypoints
      .sort((a, b) => a.waypoint_index - b.waypoint_index)
      .map((wp) => wp.trips_index ?? wp.waypoint_index);

    const orderedWaypoints = waypointOrder.map((originalIndex) => {
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
