import { Link, useLocation } from '@tanstack/react-router';

interface NavItem {
  label: string;
  to: string;
  icon: string;
  fillIcon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', to: '/farmer/dashboard', icon: 'home' },
  { label: 'Produits', to: '/farmer/stock', icon: 'inventory_2' },
  { label: 'Analyses', to: '/farmer/harvests/analyze', icon: 'query_stats' },
  { label: 'Commandes', to: '/farmer/orders', icon: 'local_shipping' },
  { label: 'Profil', to: '/farmer/profile', icon: 'person' },
];

export function FarmerBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] flex justify-around items-center h-16 max-w-[480px] mx-auto px-2 shadow-sm">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.to === '/farmer/dashboard'
            ? currentPath === '/farmer/dashboard' || currentPath === '/farmer'
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
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
