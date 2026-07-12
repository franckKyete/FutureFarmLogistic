import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { Permission } from '@futurefarm/types';
import { AdminSidebar } from '@/features/admin/components/AdminSidebar';

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    requireAuth([
      Permission.DASHBOARD_READ,
      Permission.USER_READ,
      Permission.ROLE_READ,
      Permission.DISPUTE_READ,
      Permission.INSPECTION_READ_ALL,
      Permission.DELIVERY_RUN_READ_ALL,
      Permission.AUCTION_MANAGE,
    ], 'any');
    requireRole(['Admin']);
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 ml-64">
        <Outlet />
      </main>
    </div>
  );
}
