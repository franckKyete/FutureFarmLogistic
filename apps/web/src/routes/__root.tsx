import { createRootRouteWithContext, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import type { QueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth } from '@/features/auth/store/auth.store';
import { Permission } from '@futurefarm/types';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated, can } = useAuth();

  const handleLogout = () => {
    clearAuth();
    void navigate({ to: '/auth/login' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-brand-600 font-bold text-xl tracking-tight">
              🌾 FutureFarm
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
            {isAuthenticated && (
              <>
                <Link to="/" className="hover:text-brand-600 transition-colors [&.active]:text-brand-600">
                  Dashboard
                </Link>
                {can(Permission.USER_READ) && (
                  <Link to="/admin/users" className="hover:text-brand-600 transition-colors [&.active]:text-brand-600">
                    Users
                  </Link>
                )}
                {can(Permission.ROLE_READ) && (
                  <Link to="/admin/roles" className="hover:text-brand-600 transition-colors [&.active]:text-brand-600">
                    Roles
                  </Link>
                )}
                <span className="text-gray-400">|</span>
                <span className="text-gray-500 font-normal">
                  Hello, {user?.firstName}
                </span>
                <button
                  onClick={handleLogout}
                  className="ml-2 px-4 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </>
            )}
            {!isAuthenticated && (
              <Link
                to="/auth/login"
                className="ml-2 px-4 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  );
}
