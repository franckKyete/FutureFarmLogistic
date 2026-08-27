import { useLocation, Link } from '@tanstack/react-router';

type Tab = {
  label: string;
  path: string;
  icon: string;
};

const TABS: Tab[] = [
  { label: 'Mes Tournées', path: '/driver/runs', icon: 'local_shipping' },
  { label: 'Profil & Statut', path: '/driver/profile', icon: 'person' },
];

export function DriverBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-gray-200">
      <div className="flex items-center h-16 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-1 flex-col items-center justify-center h-full transition-colors active:scale-95 duration-200 ${
                isActive ? 'text-[#004322] font-bold' : 'text-gray-400 font-medium'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
              <span className="text-[11px] mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
