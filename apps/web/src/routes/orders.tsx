import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';

export const Route = createFileRoute('/orders')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrdersLayout,
});

function OrdersLayout() {
  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
      <Outlet />
    </div>
  );
}
