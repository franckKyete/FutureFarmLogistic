import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyOrdersQuery } from '@/features/orders/api/buyer-orders.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import { OrderStatus } from '@futurefarm/types';
import { formatPriceDirect } from '@/features/currency/store/currency.store';

export const Route = createFileRoute('/orders/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    session_id?: string;
    order_id?: string;
    checkoutId?: string;
    checkoutCode?: string;
    provider?: string;
  } => {
    const res: {
      session_id?: string;
      order_id?: string;
      checkoutId?: string;
      checkoutCode?: string;
      provider?: string;
    } = {};
    if (typeof search['session_id'] === 'string' && search['session_id']) {
      res.session_id = search['session_id'];
    }
    if (typeof search['order_id'] === 'string' && search['order_id']) {
      res.order_id = search['order_id'];
    }
    if (typeof search['checkoutId'] === 'string' && search['checkoutId']) {
      res.checkoutId = search['checkoutId'];
    }
    if (typeof search['checkoutCode'] === 'string' && search['checkoutCode']) {
      res.checkoutCode = search['checkoutCode'];
    }
    if (typeof search['provider'] === 'string' && search['provider']) {
      res.provider = search['provider'];
    }
    return res;
  },
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

function getStatusBadgeStyle(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
      return 'text-amber-700 bg-amber-50 border border-amber-200';
    case OrderStatus.AWAITING_CONFIRMATION:
      return 'text-emerald-800 bg-emerald-50 border border-emerald-200';
    case OrderStatus.CONFIRMED:
    case OrderStatus.SHIPPED:
      return 'text-blue-700 bg-blue-50 border border-blue-200';
    case OrderStatus.DELIVERED:
      return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
    case OrderStatus.CANCELLED:
      return 'text-rose-700 bg-rose-50 border border-rose-200';
    default:
      return 'text-gray-700 bg-gray-50';
  }
}

function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    [OrderStatus.PENDING_PAYMENT]: 'Paiement en attente',
    [OrderStatus.AWAITING_CONFIRMATION]: 'Payée • En préparation',
    [OrderStatus.CONFIRMED]: 'Confirmée',
    [OrderStatus.SHIPPED]: 'Expédiée',
    [OrderStatus.DELIVERED]: 'Livrée',
    [OrderStatus.CANCELLED]: 'Annulée',
  };
  return labels[status] ?? status;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function OrdersListPage() {
  const { session_id, order_id, checkoutId, checkoutCode } = Route.useSearch();
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState<OrderFilter>('Toutes');

  const { data: orders, isLoading } = useQuery(getMyOrdersQuery());

  useEffect(() => {
    if (session_id || checkoutId || checkoutCode || order_id) {
      void navigate({ to: '/orders', replace: true, search: {} });
    }
  }, [session_id, checkoutId, checkoutCode, order_id, navigate]);

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
      <BuyerHeader title="Mes commandes" showBack backTo="/marketplace" />

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
              <Icon name="sync" className="text-[#1a5c35] animate-spin text-2xl" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Icon name="shopping_cart" className="text-4xl text-[#707970]" />
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
                      {formatPriceDirect(order.totalAmount, order.currency)}
                    </p>
                  </div>
                </div>

                {order.status === OrderStatus.AWAITING_CONFIRMATION && (
                  <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-[#004322]">
                    <Icon name="inventory_2" className="text-[15px] text-emerald-600" />
                    <span>Le producteur prépare votre commande et vérifie la disponibilité de chaque récolte.</span>
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
