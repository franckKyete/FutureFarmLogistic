import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { Permission } from '@futurefarm/types';
import { DriverBottomNav } from '@/features/tracking/components/DriverBottomNav';

export const Route = createFileRoute('/driver')({
  beforeLoad: () => {
    requireAuth(Permission.DELIVERY_RUN_READ);
    requireRole(['Driver', 'Admin']);
  },
  component: DriverLayout,
});

function DriverLayout() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] pb-20 max-w-lg mx-auto shadow-sm border-x border-gray-100 font-sans">
      <Outlet />
      <DriverBottomNav />
    </div>
  );
}
