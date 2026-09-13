import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSellerOrdersQuery } from '@/features/orders/api/orders.queries';
import { OrderLineStatus } from '@futurefarm/types';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';

export const Route = createFileRoute('/farmer/orders/')({
  component: OrdersPage,
});

type OrderStatusFilter = 'Toutes' | 'En attente' | "En attente d'enlèvement" | 'En transit' | 'Livrée' | 'Rejetée';

const STATUS_MAP: Record<OrderLineStatus, string> = {
  [OrderLineStatus.PENDING]: 'En attente',
  [OrderLineStatus.CONFIRMED]: "En attente d'enlèvement",
  [OrderLineStatus.REJECTED]: 'Rejetée',
  [OrderLineStatus.SHIPPED]: 'En transit',
  [OrderLineStatus.DELIVERED]: 'Livrée',
};

interface OrderLineExtended {
  id: string;
  orderId: string;
  productName: string;
  buyerLabel: string;
  location: string;
  status: OrderLineStatus;
  weight: string;
  price: string;
  totalPrice: number;
  imgUrl: string;
  notes: string | null;
  rejectionReason: string | null;
}

function OrdersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OrderStatusFilter>('Toutes');

  useFarmerLayout({
    title: 'Mes commandes',
    showBack: true,
    backTo: '/farmer/dashboard',
  });

  // Queries
  const { data: orderLines } = useQuery(getSellerOrdersQuery());

  const extendedLines: OrderLineExtended[] = (orderLines || []).map((line) => {
    const address = line.order?.deliveryAddress;
    const locationStr = address ? `${address.city}, ${address.country}` : 'Adresse non spécifiée';
    const buyerName = line.order?.buyer
      ? `${line.order.buyer.firstName || ''} ${line.order.buyer.lastName || ''}`.trim()
      : null;
    const buyerDisplay = buyerName || `Client #${line.order?.buyerId?.slice(0, 4) || 'Anon'}`;

    return {
      id: line.id,
      orderId: line.orderId,
      productName: line.harvest?.product?.name || 'Produit inconnu',
      buyerLabel: buyerDisplay,
      location: locationStr,
      status: line.status,
      weight: `${line.quantity} ${line.harvest?.unit || 'kg'}`,
      price: `${Number(line.totalPrice).toLocaleString()} ${line.currency || line.order?.currency || 'CDF'}`,
      totalPrice: Number(line.totalPrice),
      imgUrl: line.harvest?.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100',
      notes: line.order?.notes || null,
      rejectionReason: line.rejectionReason,
    };
  });

  const filteredOrders = extendedLines.filter((order) => {
    const matchedStatusText = STATUS_MAP[order.status];
    const matchesFilter = activeFilter === 'Toutes' || matchedStatusText === activeFilter;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyerLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate statistics
  const totalCount = extendedLines.length;
  const pendingCount = extendedLines.filter((l) => l.status === OrderLineStatus.PENDING).length;
  const transitCount = extendedLines.filter((l) => l.status === OrderLineStatus.SHIPPED).length;
  const deliveredCount = extendedLines.filter((l) => l.status === OrderLineStatus.DELIVERED).length;

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-background relative font-sans text-on-surface pb-24">
      {/* Main Content Area */}
      <main className="pt-4 px-4 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total ventes</p>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-primary leading-none">{totalCount}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">En attente</p>
              {pendingCount > 0 && (
                <span className="bg-[#ffa93d]/20 text-[#885200] text-[9px] px-1.5 py-0.5 rounded font-bold">À TRAITER</span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-secondary leading-none">{pendingCount}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">En transit</p>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-primary leading-none">{transitCount}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Livrées</p>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-primary leading-none">{deliveredCount}</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-outline-variant rounded-xl py-3 pl-11 pr-4 text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/40"
            placeholder="Numéro commande, produit, client..."
            type="text"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
          {(['Toutes', 'En attente', "En attente d'enlèvement", 'En transit', 'Livrée', 'Rejetée'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-primary text-white font-bold'
                    : 'bg-white border border-outline-variant text-on-surface-variant hover:border-primary'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Vertical Order List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const matchedStatusText = STATUS_MAP[order.status];
            const statusColor =
              order.status === OrderLineStatus.PENDING
                ? 'bg-[#ffa93d]/20 text-[#885200]'
                : order.status === OrderLineStatus.SHIPPED
                  ? 'bg-primary/10 text-primary'
                  : order.status === OrderLineStatus.DELIVERED
                    ? 'bg-[#aef2be]/30 text-[#0b522c] opacity-60'
                    : order.status === OrderLineStatus.CONFIRMED
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-rose-50 text-rose-700';

            return (
              <div
                key={order.id}
                onClick={() => void navigate({ to: '/farmer/orders/$id', params: { id: order.orderId } })}
                className="bg-white rounded-xl p-4 border border-outline-variant space-y-4 shadow-sm hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <span className="text-primary font-bold text-xs">Réf : #{order.orderId.slice(0, 8)}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
                    {matchedStatusText}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <img className="w-12 h-12 rounded-lg object-cover bg-surface-container-low border border-outline-variant/30" alt={order.productName} src={order.imgUrl} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold truncate text-[#1C1C1C]">{order.productName}</h3>
                    <p className="text-xs text-on-surface-variant truncate">
                      {order.buyerLabel}, {order.location}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-outline-variant/30">
                  <div className="flex gap-4 items-center">
                    <span className="text-xs text-on-surface-variant">{order.weight}</span>
                    <span className="text-sm font-bold text-on-surface">{order.price}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigate({ to: '/farmer/orders/$id', params: { id: order.orderId } });
                    }}
                    className="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    Fiche détails
                  </button>
                </div>
              </div>
            );
          })}
          {filteredOrders.length === 0 && (
            <p className="text-center text-xs text-on-surface-variant py-8 font-semibold">
              Aucune commande trouvée.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
