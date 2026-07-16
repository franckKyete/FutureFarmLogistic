import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { Permission } from '@futurefarm/types';
import { AdminSidebar, AdminHeader } from '@/features/admin/components';
import '@fontsource-variable/geist';
import '@/styles/admin-theme.css';

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
      Permission.ORDER_READ_ALL,
    ], 'any');
    requireRole(['Admin']);
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="admin-theme min-h-screen bg-[#EAF3DE]">
      <AdminSidebar />
      <AdminHeader />
      <main className="ml-[240px] pt-[60px] min-h-[calc(100vh-60px)] p-8">
        <div className="max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

