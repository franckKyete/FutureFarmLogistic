import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { Permission } from '@futurefarm/types';
import { InspectorBottomNav } from '@/features/inspector/components/InspectorBottomNav';

export const Route = createFileRoute('/inspector')({
  beforeLoad: () => {
    requireAuth([
      Permission.INSPECTION_READ,
      Permission.VISIT_READ,
      Permission.DASHBOARD_READ,
    ], 'any');
    requireRole(['Inspector']);
  },
  component: InspectorLayout,
});

function InspectorLayout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Outlet />
      <InspectorBottomNav />
    </div>
  );
}
