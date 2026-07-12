import { useLocation, Link } from '@tanstack/react-router';

type Tab = {
  label: string;
  path: string;
  icon: string;
};

const TABS: Tab[] = [
  { label: 'Tableau de bord', path: '/inspector/dashboard', icon: 'dashboard' },
  { label: 'Producteurs', path: '/inspector/accounts', icon: 'group' },
  { label: 'Qualité', path: '/inspector/validate', icon: 'verified' },
  { label: 'Planning', path: '/inspector/planning', icon: 'calendar_month' },
];

export function InspectorBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center h-16 max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-1 flex-col items-center justify-center h-full transition-colors active:scale-95 duration-200 ${
                isActive ? 'text-[#1a5c35]' : 'text-gray-400'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
              <span className="text-[10px] font-semibold mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
