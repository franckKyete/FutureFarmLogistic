import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { getFarmerProfileQuery } from '@/features/profile/api/profile.queries';
import { farmerLayoutStore } from '../store/farmer-layout.store';
import { useStore } from '@tanstack/react-store';
import type { ReactNode } from 'react';

export function FarmerHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useQuery(getFarmerProfileQuery());
  const override = useStore(farmerLayoutStore);

  const pathname = location.pathname;

  // Custom override
  if (override.hideTopBar) return null;

  // Route: Dashboard (/farmer or /farmer/dashboard)
  if (pathname === '/farmer' || pathname === '/farmer/dashboard') {
    return (
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="flex justify-between items-center h-16 px-4 max-w-[480px] mx-auto">
          <div className="flex items-center gap-3">
            <Link
              to="/farmer/profile"
              className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden bg-[#1A5C35]/10 flex items-center justify-center cursor-pointer"
            >
              {profile?.avatarUrl ? (
                <img
                  alt={user?.firstName || 'Farmer'}
                  className="w-full h-full object-cover"
                  src={profile.avatarUrl}
                />
              ) : (
                <img
                  alt={user?.firstName || 'Farmer'}
                  className="w-full h-full object-cover"
                  src={
                    user
                      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(`${user.firstName} ${user.lastName}`)}&background=1A5C35&color=fff&bold=true`
                      : 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100'
                  }
                />
              )}
            </Link>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-sm font-bold text-on-surface">
                  {user ? `${user.firstName} ${user.lastName}` : 'Producteur'}
                </h1>
                <span
                  className="material-symbols-outlined text-[16px] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield_with_heart
                </span>
              </div>
              <p className="text-[10px] font-semibold text-outline">
                {profile?.companyName || 'Producteur Premium'}
              </p>
            </div>
          </div>
          <Link
            to="/notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer text-on-surface"
          >
            <span className="material-symbols-outlined">notifications</span>
          </Link>
        </div>
      </header>
    );
  }

  // Route-based default configs
  let title = override.title;
  const subtitle = override.subtitle;
  let icon = 'agriculture';
  let showBack = override.showBack ?? false;
  let backTo = override.backTo;
  let rightAction: ReactNode = override.rightAction;

  if (!title) {
    if (pathname.startsWith('/farmer/stock')) {
      title = 'Gestion des stocks';
      icon = 'inventory_2';
      rightAction = (
        <Link
          to="/notifications"
          className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant"
        >
          <span className="material-symbols-outlined">notifications</span>
        </Link>
      );
    } else if (pathname.startsWith('/farmer/analytics')) {
      title = 'Analytiques & revenus';
      icon = 'query_stats';
      rightAction = (
        <Link
          to="/notifications"
          className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant"
        >
          <span className="material-symbols-outlined">notifications</span>
        </Link>
      );
    } else if (pathname.startsWith('/farmer/orders')) {
      title = 'Mes commandes';
      showBack = true;
      backTo = '/farmer/dashboard';
      rightAction = (
        <Link
          to="/notifications"
          className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant"
        >
          <span className="material-symbols-outlined">notifications</span>
        </Link>
      );
    } else if (pathname.startsWith('/farmer/profile')) {
      title = 'Profil Producteur';
      icon = 'person';
      rightAction = (
        <Link
          to="/notifications"
          className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant"
        >
          <span className="material-symbols-outlined">notifications</span>
        </Link>
      );
    } else if (pathname === '/farmer/auctions' || pathname === '/farmer/auctions/') {
      title = 'Enchères';
      icon = 'gavel';
      rightAction = (
        <Link
          to="/farmer/auctions/new"
          className="p-2 bg-[#004322] text-white rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-sm">add</span>
        </Link>
      );
    } else if (pathname.startsWith('/farmer/auctions/new')) {
      title = 'Nouvelle enchère';
      showBack = true;
      backTo = '/farmer/auctions';
    } else if (pathname.startsWith('/farmer/auctions/bids')) {
      title = 'Mes Enchères';
      showBack = true;
      backTo = '/farmer/auctions';
    } else if (pathname.includes('/farmer/auctions/') && pathname.endsWith('/bidders')) {
      title = 'Enchère en direct';
      showBack = true;
      backTo = '/farmer/auctions';
    } else if (pathname.startsWith('/farmer/harvests/new')) {
      title = 'Nouvelle récolte';
      showBack = true;
      backTo = '/farmer/stock';
    } else if (pathname.startsWith('/farmer/products/')) {
      title = 'Détails Produit';
      showBack = true;
      backTo = '/farmer/stock';
    } else {
      title = 'Future Farm';
      icon = 'agriculture';
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-outline-variant shadow-sm">
      <div className="flex justify-between items-center h-16 px-4 max-w-[480px] mx-auto">
        <div className="flex items-center gap-3">
          {showBack ? (
            backTo ? (
              <Link to={backTo} className="text-primary hover:opacity-80 transition-opacity p-1 -ml-1">
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
              </Link>
            ) : (
              <button
                onClick={() => void navigate({ to: '/farmer/dashboard' })}
                className="text-primary hover:opacity-80 transition-opacity p-1 -ml-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
              </button>
            )
          ) : (
            <span
              className="material-symbols-outlined text-primary text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          )}
          <div>
            <h1 className="text-base font-bold text-on-surface">{title}</h1>
            {subtitle && <p className="text-[10px] text-outline">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
