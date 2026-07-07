import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';

export const Route = createFileRoute('/farmer')({
  beforeLoad: () => {
    requireAuth();
  },
  component: FarmerLayout,
});

function FarmerLayout() {
  return <Outlet />;
}
