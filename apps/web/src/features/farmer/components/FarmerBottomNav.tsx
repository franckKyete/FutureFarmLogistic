import { Link, useLocation } from '@tanstack/react-router';
import { farmerLayoutStore } from '../store/farmer-layout.store';
import { useStore } from '@tanstack/react-store';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Icon } from '@/features/shared/components/Icon';

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', to: '/farmer/dashboard', icon: 'home' },
  { label: 'Produits', to: '/farmer/stock', icon: 'inventory_2' },
  { label: 'Enchères', to: '/farmer/auctions', icon: 'gavel' },
  { label: 'Commandes', to: '/farmer/orders', icon: 'local_shipping' },
];

const BUYER_NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', to: '/marketplace', icon: 'home' },
  { label: 'Produits', to: '/marketplace', icon: 'store' },
  { label: 'Enchères', to: '/auctions', icon: 'gavel' },
  { label: 'Commandes', to: '/orders', icon: 'receipt_long' },
  { label: 'Profil', to: '/profile', icon: 'person' },
];

export function FarmerBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const override = useStore(farmerLayoutStore);
  const currentPath = location.pathname;

  if (override.hideBottomNav) return null;

  // On farmer profile, if viewed by a buyer or with target id, never render bottom nav
  const hasTargetId = Boolean(
    (location.search as any)?.id || (location as any).searchStr?.includes('id='),
  );
  if (
    currentPath === '/farmer/profile' ||
    currentPath.startsWith('/farmer/profile/')
  ) {
    if (!user?.roles?.includes('Farmer') || hasTargetId) {
      return null;
    }
  }

  const isBuyerOnly = !!user?.roles?.includes('Buyer') && !user?.roles?.includes('Farmer');
  const items = isBuyerOnly ? BUYER_NAV_ITEMS : NAV_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] flex justify-around items-center h-16 max-w-[480px] mx-auto px-2 shadow-sm">
      {items.map((item) => {
        const isActive =
          item.to === '/farmer/dashboard' || item.to === '/marketplace'
            ? currentPath === item.to || (item.to === '/farmer/dashboard' && currentPath === '/farmer')
            : currentPath.startsWith(item.to);

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 active:scale-90 cursor-pointer ${
              isActive
                ? 'text-[#1A5C35] font-bold'
                : 'text-[#4B5344] hover:text-[#1A5C35] font-medium'
            }`}
          >
            <Icon
              name={item.icon}
              size={22}
              className={`transition-transform duration-150 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`}
            />
            <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
