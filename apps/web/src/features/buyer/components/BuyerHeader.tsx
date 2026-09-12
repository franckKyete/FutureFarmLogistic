import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth } from '@/features/auth/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { getBasketQuery } from '@/features/basket/api/basket.queries';
import { getMyNotificationsQuery } from '@/features/notifications/api/notifications.queries';
import { NotificationStatus } from '@futurefarm/types';
import { useStore } from '@tanstack/react-store';
import { buyerLayoutStore, type BuyerLayoutState } from '../store/buyer-layout.store';
import { CountryCurrencySelector } from '@/features/currency/components/CountryCurrencySelector';

export interface BuyerHeaderProps extends Partial<BuyerLayoutState> {
  className?: string;
}

export function BuyerHeader(props: BuyerHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const storeState = useStore(buyerLayoutStore);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Merge store state and explicit props (props take precedence)
  const title = props.title ?? storeState.title ?? 'Marché';
  const subtitle = props.subtitle ?? storeState.subtitle;
  const showBack = props.showBack ?? storeState.showBack ?? false;
  const backTo = props.backTo ?? storeState.backTo;
  const rightAction = props.rightAction ?? storeState.rightAction;
  const hideTopBar = props.hideTopBar ?? storeState.hideTopBar ?? false;
  const hideCart = props.hideCart ?? storeState.hideCart ?? false;

  const pathname = location.pathname;

  // Basket query for live count
  const { data: basket } = useQuery({
    ...getBasketQuery(),
    enabled: isAuthenticated,
  });

  const basketCount = useMemo(() => {
    if (!isAuthenticated || !basket?.lines) return 0;
    return basket.lines.length;
  }, [isAuthenticated, basket]);

  // Notifications query for unread badge
  const { data: paginatedNotifications } = useQuery({
    ...getMyNotificationsQuery({ limit: 50 }),
    enabled: isAuthenticated,
  });

  const unreadCount = useMemo(() => {
    if (!isAuthenticated || !paginatedNotifications?.data) return 0;
    return paginatedNotifications.data.filter(
      (n) => n.status !== NotificationStatus.READ,
    ).length;
  }, [isAuthenticated, paginatedNotifications]);

  if (hideTopBar) return null;

  const handleLogout = () => {
    clearAuth();
    setIsMenuOpen(false);
    void navigate({ to: '/auth/login' });
  };

  const navLinks = [
    {
      to: '/marketplace',
      label: 'Marché',
      icon: 'store',
      badge: null,
    },
    {
      to: '/cart',
      label: 'Mon Panier',
      icon: 'shopping_cart',
      badge: basketCount > 0 ? basketCount : null,
    },
    {
      to: '/orders',
      label: 'Mes Commandes',
      icon: 'receipt_long',
      badge: null,
    },
    {
      to: '/auctions',
      label: 'Enchères',
      icon: 'gavel',
      badge: null,
    },
    {
      to: '/notifications',
      label: 'Notifications',
      icon: 'notifications',
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      to: '/profile',
      label: 'Mon Profil',
      icon: 'person',
      badge: null,
    },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#c0c9be] shadow-sm">
        <div className="flex justify-between items-center h-16 px-4 max-w-[480px] mx-auto">
          {/* Left section: Back button or Brand Title */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showBack ? (
              backTo ? (
                <Link
                  to={backTo}
                  className="p-2 -ml-2 text-[#004322] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer shrink-0"
                  aria-label="Retour"
                >
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </Link>
              ) : (
                <button
                  onClick={() => window.history.back()}
                  className="p-2 -ml-2 text-[#004322] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer shrink-0"
                  aria-label="Retour"
                >
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
              )
            ) : null}

            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-bold text-[#004322] truncate">{title}</h1>
              {subtitle && <p className="text-[10px] font-semibold text-[#707970] truncate">{subtitle}</p>}
            </div>
          </div>

          {/* Right section: Actions, Currency, Cart, Notifications, Hamburger */}
          <div className="flex items-center gap-1.5 shrink-0">
            {rightAction}

            <CountryCurrencySelector />

            {!hideCart && pathname !== '/cart' && (
              <Link
                to="/cart"
                className="relative p-2 text-[#404941] hover:text-[#004322] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer"
                title="Panier"
                aria-label="Mon Panier"
              >
                <span className="material-symbols-outlined text-[22px]">shopping_cart</span>
                {basketCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {basketCount > 99 ? '99+' : basketCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              to="/notifications"
              className="relative p-2 text-[#404941] hover:text-[#004322] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer"
              title="Notifications"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#1a5c35] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 text-[#404941] hover:text-[#004322] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer"
              title="Menu"
              aria-label="Menu principal"
              data-testid="buyer-hamburger-btn"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger Drawer Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMenuOpen(false)}
            data-testid="drawer-backdrop"
          />

          {/* Drawer Content */}
          <aside className="relative w-full max-w-[300px] bg-white h-full shadow-2xl flex flex-col justify-between z-10 border-l border-[#c0c9be] animate-in slide-in-from-right duration-200">
            {/* Drawer Header: User Profile & Close button */}
            <div>
              <div className="p-4 border-b border-[#c0c9be] bg-[#f8f9ff] flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#1a5c35] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0b1c30] truncate">
                      {user ? `${user.firstName} ${user.lastName}` : 'Acheteur'}
                    </p>
                    <p className="text-xs text-[#707970] truncate">{user?.email || 'Non connecté'}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.2 bg-[#E8F5E9] text-[#1A5C35] text-[9px] font-bold rounded-full">
                      Acheteur
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 text-[#707970] hover:text-[#0b1c30] hover:bg-gray-200/50 rounded-full transition-colors cursor-pointer"
                  aria-label="Fermer"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="p-3 space-y-1">
                {navLinks.map((link) => {
                  const isActive =
                    pathname === link.to || (link.to !== '/marketplace' && pathname.startsWith(link.to));

                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#1a5c35] text-white'
                          : 'text-[#404941] hover:bg-[#eff4ff] hover:text-[#004322]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {link.icon}
                        </span>
                        <span>{link.label}</span>
                      </div>
                      {link.badge !== null && link.badge > 0 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isActive ? 'bg-white text-[#1a5c35]' : 'bg-[#1a5c35] text-white'
                          }`}
                        >
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer: Logout or Login */}
            <div className="p-4 border-t border-[#c0c9be] bg-[#f8f9ff]">
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Se déconnecter
                </button>
              ) : (
                <Link
                  to="/auth/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1a5c35] text-white hover:bg-[#004322] font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Se connecter
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
