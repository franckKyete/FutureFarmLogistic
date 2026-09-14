import { Icon } from '@/features/shared/components/Icon';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { getAccessToken } from '@/features/auth/store/auth.store';
import { useToasts, removeToast, addToast } from '@/features/shared/store/toast.store';
import { initOfflineSyncListeners } from '@/features/harvests/offline';
import { initializeCurrencyStore } from '@/features/currency/store/currency.store';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { queryClient } = Route.useRouteContext();
  const { user, isAuthenticated } = useAuth();
  const toasts = useToasts();

  useEffect(() => {
    initializeCurrencyStore();
  }, [user]);

  useEffect(() => {
    const cleanup = initOfflineSyncListeners(queryClient);
    return () => {
      cleanup();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    const baseUrl = (import.meta.env['VITE_API_BASE_URL'] as string) || 'http://localhost:3000/v1';
    const socketUrl = baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl;

    const socket = io(`${socketUrl}/notifications`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('subscribe');
    });

    socket.on('notification:new', (notification: { body?: string; title?: string }) => {
      addToast(notification.body || notification.title || 'Nouvelle notification', 'info');
    });

    socket.on('order:status_changed', (data: { orderId: string; status: string; paymentStatus: string; message?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data.paymentStatus === 'PAID') {
        addToast(data.message || 'Paiement confirmé avec succès !', 'success');
      } else if (data.paymentStatus === 'FAILED') {
        addToast(data.message || 'Le paiement a échoué.', 'error');
      } else if (data.message) {
        addToast(data.message, 'info');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient]);

  // Global socket listener for auction real-time lifecycle updates
  useEffect(() => {
    const baseUrl = (import.meta.env['VITE_API_BASE_URL'] as string) || 'http://localhost:3000/v1';
    const socketUrl = baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl;

    const auctionSocket = io(`${socketUrl}/auctions`, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    const handleAuctionChange = () => {
      void queryClient.invalidateQueries({ queryKey: ['auctions'] });
    };

    auctionSocket.on('auction:sold', handleAuctionChange);
    auctionSocket.on('auction:expired', handleAuctionChange);
    auctionSocket.on('auction:cancelled', handleAuctionChange);
    auctionSocket.on('auction:price_tick', handleAuctionChange);

    return () => {
      auctionSocket.disconnect();
    };
  }, [queryClient]);

  const renderToasts = () => (
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
          <Icon name={toast.type === 'success'
              ? 'check_circle'
              : toast.type === 'error'
              ? 'error'
              : toast.type === 'warning'
              ? 'warning'
              : 'info'} className="text-[20px]" />
          <span className="flex-1 leading-snug">{toast.message}</span>
          <Icon name="close" className="text-[16px] opacity-70 hover:opacity-100" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Outlet />
      {renderToasts()}
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </div>
  );
}
