import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyOrdersQuery } from '@/features/orders/api/buyer-orders.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { OrderStatus } from '@futurefarm/types';

export const Route = createFileRoute('/orders/')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrdersListPage,
});

type OrderFilter = 'Toutes' | 'En cours' | 'Terminées' | 'Annulées';

const FILTER_STATUS_MAP: Record<OrderFilter, OrderStatus[]> = {
  Toutes: [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.AWAITING_CONFIRMATION,
    OrderStatus.CONFIRMED,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  'En cours': [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.AWAITING_CONFIRMATION,
    OrderStatus.CONFIRMED,
    OrderStatus.SHIPPED,
  ],
  Terminées: [OrderStatus.DELIVERED],
  Annulées: [OrderStatus.CANCELLED],
};

function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    [OrderStatus.PENDING_PAYMENT]: 'Paiement en attente',
    [OrderStatus.AWAITING_CONFIRMATION]: 'En attente de confirmation',
    [OrderStatus.CONFIRMED]: 'Confirmée',
    [OrderStatus.SHIPPED]: 'Expédiée',
    [OrderStatus.DELIVERED]: 'Livrée',
    [OrderStatus.CANCELLED]: 'Annulée',
  };
  return labels[status];
}

function getStatusBadgeStyle(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
    case OrderStatus.AWAITING_CONFIRMATION:
      return 'text-amber-700 bg-amber-50';
    case OrderStatus.CONFIRMED:
    case OrderStatus.SHIPPED:
      return 'text-blue-700 bg-blue-50';
    case OrderStatus.DELIVERED:
      return 'text-emerald-700 bg-emerald-50';
    case OrderStatus.CANCELLED:
      return 'text-rose-700 bg-rose-50';
  }
}

function formatPrice(amount: number): string {
  return `${amount.toLocaleString()} FCFA`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function OrdersListPage() {
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('Toutes');

  const { data: orders, isLoading } = useQuery(getMyOrdersQuery());

  const filteredOrders = (orders || []).filter((order) =>
    FILTER_STATUS_MAP[activeFilter].includes(order.status),
  );

  const counts: Record<OrderFilter, number> = {
    Toutes: orders?.length || 0,
    'En cours':
      orders?.filter((o) =>
        FILTER_STATUS_MAP['En cours'].includes(o.status),
      ).length || 0,
    Terminées:
      orders?.filter((o) =>
        FILTER_STATUS_MAP['Terminées'].includes(o.status),
      ).length || 0,
    Annulées:
      orders?.filter((o) =>
        FILTER_STATUS_MAP['Annulées'].includes(o.status),
      ).length || 0,
  };

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff] relative pb-24">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-[#c0c9be] max-w-[480px] mx-auto">
        <div className="flex justify-between items-center px-4 h-16">
          <h1 className="text-sm font-bold text-[#0b1c30]">Mes commandes</h1>
          <button
            onClick={() => window.location.reload()}
            className="material-symbols-outlined text-[#404941] cursor-pointer p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-4 space-y-6">
        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
          {(Object.keys(FILTER_STATUS_MAP) as OrderFilter[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#1a5c35] text-white font-bold'
                    : 'bg-white border border-[#c0c9be] text-[#404941] hover:border-[#1a5c35]'
                }`}
              >
                {filter}
                {!isActive && counts[filter] > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">({counts[filter]})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Order List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined text-[#1a5c35] animate-spin text-2xl">
                sync
              </span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <span className="material-symbols-outlined text-4xl text-[#707970]">
                shopping_cart
              </span>
              <p className="text-sm font-semibold text-[#707970]">Aucune commande</p>
              <Link
                to="/marketplace"
                className="inline-block px-6 py-2.5 bg-[#1a5c35] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Découvrir le marché
              </Link>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <Link
                key={order.id}
                to="/orders/$id"
                params={{ id: order.id }}
                className="block bg-white rounded-xl border border-[#c0c9be] p-4 space-y-3 hover:shadow-sm transition-shadow active:scale-[0.99]"
              >
                {/* Header: Ref + Status */}
                <div className="flex justify-between items-center">
                  <span className="text-[#004322] font-bold text-xs">
                    Réf : {order.id.slice(0, 8)}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeStyle(order.status)}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                {/* Info lines */}
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-xs text-[#707970]">
                      {order.lines.length} article{order.lines.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-[#707970]">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0b1c30]">
                      {formatPrice(order.totalAmount)}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-[#c0c9be] max-w-[480px] mx-auto">
        <div className="flex justify-around items-center h-16">
          <Link
            to="/notifications"
            className="flex flex-col items-center justify-center text-[#707970] hover:text-[#1a5c35] transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="text-[10px] font-bold">Notifications</span>
          </Link>
          <Link
            to="/orders"
            className="flex flex-col items-center justify-center text-[#1a5c35] transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              receipt_long
            </span>
            <span className="text-[10px] font-bold">Commandes</span>
          </Link>
          <Link
            to="/marketplace"
            className="flex flex-col items-center justify-center text-[#707970] hover:text-[#1a5c35] transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">store</span>
            <span className="text-[10px] font-bold">Marketplace</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
