import { useEffect } from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { Permission } from '@futurefarm/types';
import { DriverBottomNav } from '@/features/tracking/components/DriverBottomNav';
import { DispatchModal } from '@/features/tracking/components/DispatchModal';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/store/auth.store';

export const Route = createFileRoute('/driver')({
  beforeLoad: () => {
    requireAuth(Permission.DELIVERY_RUN_READ);
    requireRole(['Driver', 'Admin']);
  },
  component: DriverLayout,
});

function DriverLayout() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!navigator.geolocation || !user) return;

    // Immediately record driver location whenever app is opened or active
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiClient.post('/logistics/location', {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lon: Number(pos.coords.longitude.toFixed(6)),
            heading: pos.coords.heading != null ? Number(pos.coords.heading.toFixed(2)) : undefined,
            speedKmh: pos.coords.speed != null ? Number((pos.coords.speed * 3.6).toFixed(2)) : undefined,
          });
        } catch (err) {
          console.warn('[DriverLocation] Failed to record initial driver position:', err);
        }
      },
      (err) => {
        console.warn('[DriverLocation] Geolocation permission/access error:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  }, [user]);

  return (
    <div className="min-h-screen bg-[#f8f9ff] pb-20 max-w-lg mx-auto shadow-sm border-x border-gray-100 font-sans">
      <DispatchModal />
      <Outlet />
      <DriverBottomNav />
    </div>
  );
}
