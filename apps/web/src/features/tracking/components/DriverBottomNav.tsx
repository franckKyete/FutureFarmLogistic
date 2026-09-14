import { useLocation, Link } from '@tanstack/react-router';
import { Icon } from '@/features/shared/components/Icon';

type Tab = {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
};

const TABS: Tab[] = [
  { label: 'Dashboard', path: '/driver', icon: 'grid_view', exact: true },
  { label: 'Itinéraire', path: '/driver/routes', icon: 'alt_route' },
  { label: 'Historique', path: '/driver/runs', icon: 'local_shipping' },
  { label: 'Profil', path: '/driver/profile', icon: 'person' },
];

export function DriverBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-gray-200">
      <div className="flex items-center h-16 max-w-lg mx-auto px-2">
        {TABS.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.path || location.pathname === `${tab.path}/`
            : location.pathname.startsWith(tab.path);

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-1 flex-col items-center justify-center h-full transition-transform active:scale-95 duration-150"
            >
              <div
                className={`flex items-center justify-center px-4 py-1 rounded-full transition-all ${
                  isActive
                    ? 'bg-[#f59e0b]/20 text-[#b45309]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon
                  name={tab.icon}
                  size={20}
                  className={isActive ? 'text-[#b45309]' : 'text-gray-500'}
                />
              </div>
              <span
                className={`text-[10px] mt-0.5 font-bold ${
                  isActive ? 'text-[#b45309]' : 'text-gray-500 font-medium'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
