import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
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
  const location = useLocation();
  const isWorkflowRoute =
    location.pathname.startsWith('/inspector/reports/') ||
    location.pathname === '/inspector/proxy';

  return (
    <div className={`min-h-screen bg-gray-50 ${isWorkflowRoute ? '' : 'pb-16'}`}>
      <Outlet />
      {!isWorkflowRoute && <InspectorBottomNav />}
    </div>
  );
}
