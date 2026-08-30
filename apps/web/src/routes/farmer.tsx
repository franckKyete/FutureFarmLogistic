import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { FarmerBottomNav } from '@/features/farmer/components/FarmerBottomNav';
import { FarmerHeader } from '@/features/farmer/components/FarmerHeader';
import { farmerLayoutStore } from '@/features/farmer/store/farmer-layout.store';
import { useStore } from '@tanstack/react-store';

export const Route = createFileRoute('/farmer')({
  beforeLoad: () => {
    requireAuth();
    requireRole(['Farmer']);
  },
  component: FarmerLayout,
});

const NO_TOP_BAR_ROUTES = [
  '/farmer/harvests/analyze',
  '/farmer/welcome',
  '/farmer/onboarding',
];

const NO_BOTTOM_NAV_ROUTES = [
  '/farmer/harvests/analyze',
  '/farmer/welcome',
  '/farmer/onboarding',
];

function FarmerLayout() {
  const location = useLocation();
  const layout = useStore(farmerLayoutStore);

  const pathname = location.pathname;
  const hideTopBar =
    layout.hideTopBar ??
    NO_TOP_BAR_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));
  const hideBottomNav =
    layout.hideBottomNav ??
    NO_BOTTOM_NAV_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  return (
    <div
      className={`min-h-screen bg-background ${!hideTopBar ? 'pt-16' : ''} ${
        !hideBottomNav ? 'pb-24' : ''
      }`}
    >
      {!hideTopBar && <FarmerHeader />}
      <Outlet />
      {!hideBottomNav && <FarmerBottomNav />}
    </div>
  );
}
