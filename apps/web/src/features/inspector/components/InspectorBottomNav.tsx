import { useLocation, Link } from '@tanstack/react-router';
import { Icon } from '@/features/shared/components/Icon';

type Tab = {
  label: string;
  path: string;
  icon: string;
};

const TABS: Tab[] = [
  { label: 'Accueil', path: '/inspector/dashboard', icon: 'dashboard' },
  { label: 'Inspections', path: '/inspector/validate', icon: 'fact_check' },
  { label: 'Planning', path: '/inspector/planning', icon: 'calendar_month' },
  { label: 'Producteurs', path: '/inspector/accounts', icon: 'people' },
  { label: 'Profil', path: '/inspector/profile', icon: 'person' },
];

export function InspectorBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center h-16 max-w-lg mx-auto px-2">
        {TABS.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-1 flex-col items-center justify-center h-full transition-colors active:scale-95 duration-200 ${
                isActive ? 'text-[#1a5c35] font-bold' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon
                name={tab.icon}
                size={22}
                className={isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}
              />
              <span className="text-[11px] mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
