import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { LiveLocation } from './useDeliveryMap';

export function useOrderTracking(orderId?: string | null) {
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!orderId) {
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
      socket.emit('join_order_tracking', { orderId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Receives obfuscated coordinates from the backend
    socket.on(
      'driver:location:update',
      (data: { driverId: string; lat: number; lon: number; heading?: number | null }) => {
        setLiveLocation({
          lat: Number(data.lat),
          lon: Number(data.lon),
          heading: data.heading != null ? data.heading : undefined,
          recordedAt: new Date().toISOString(),
        });
      },
    );

    return () => {
      socket.emit('leave_order_tracking', { orderId });
      socket.disconnect();
    };
  }, [orderId]);

  return { location: liveLocation, isConnected };
}
