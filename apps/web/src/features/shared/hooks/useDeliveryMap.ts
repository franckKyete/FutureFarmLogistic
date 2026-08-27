import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getRunLocationQuery } from '@/features/tracking/api/tracking.queries';

export interface LiveLocation {
  lat: number;
  lon: number;
  heading?: number | undefined;
  speedKmh?: number | undefined;
  recordedAt?: string | undefined;
}

export function useDeliveryMap(runId?: string | null) {
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fallback polling every 15 seconds
  const { data: polledLocation } = useQuery({
    ...(runId ? getRunLocationQuery(runId) : { queryKey: ['tracking', 'runs', 'none'], queryFn: async () => null }),
    refetchInterval: 15_000,
    enabled: !!runId,
  });

  useEffect(() => {
    if (!runId) {
      setIsConnected(false);
      return;
    }

    const apiBase = (import.meta.env['VITE_API_BASE_URL'] as string) || '';
    const wsUrl = apiBase.replace(/\/v1\/?$/, '') || window.location.origin;
    const token = localStorage.getItem('access_token');

    const socket = io(`${wsUrl}/logistics`, {
      ...(token ? { auth: { token: `Bearer ${token}` } } : {}),
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_run', { runId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('driver:location:update', (data: { driverId: string; lat: number; lon: number; heading?: number | null }) => {
      setLiveLocation({
        lat: Number(data.lat),
        lon: Number(data.lon),
        heading: data.heading != null ? data.heading : undefined,
        recordedAt: new Date().toISOString(),
      });
    });

    return () => {
      socket.emit('leave_run', { runId });
      socket.disconnect();
    };
  }, [runId]);

  const location: LiveLocation | null =
    liveLocation ||
    (polledLocation
      ? {
          lat: Number(polledLocation.lat),
          lon: Number(polledLocation.lon),
          heading: polledLocation.heading ?? undefined,
          speedKmh: polledLocation.speedKmh ?? undefined,
          recordedAt: polledLocation.recordedAt,
        }
      : null);

  return { location, isConnected };
}
