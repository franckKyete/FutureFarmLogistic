import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';

export const Route = createFileRoute('/farmer')({
  beforeLoad: () => {
    requireAuth();
    requireRole(['Farmer']);
  },
  component: FarmerLayout,
});

function FarmerLayout() {
  return <Outlet />;
}
