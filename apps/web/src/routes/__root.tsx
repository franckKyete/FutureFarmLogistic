import { createRootRouteWithContext, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import type { QueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth } from '@/features/auth/store/auth.store';
import { useToasts, removeToast } from '@/features/shared/store/toast.store';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const toasts = useToasts();

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

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border text-sm font-semibold transition-all cursor-pointer hover:opacity-95 animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 0" }}>
              {toast.type === 'success'
                ? 'check_circle'
                : toast.type === 'error'
                ? 'error'
                : toast.type === 'warning'
                ? 'warning'
                : 'info'}
            </span>
            <span className="flex-1 leading-snug">{toast.message}</span>
            <span className="material-symbols-outlined text-[16px] opacity-70 hover:opacity-100">
              close
            </span>
          </div>
        ))}
      </div>

      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  );
}
