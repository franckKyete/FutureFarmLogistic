import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getSellerOrdersQuery,
  confirmOrderLineMutation,
  rejectOrderLineMutation,
  shipOrderLinesMutation,
  deliverOrderLinesMutation,
} from '@/features/orders/api/orders.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { OrderLineStatus } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/orders')({
  component: OrdersPage,
});

type OrderStatusFilter = 'Toutes' | 'En attente' | 'Confirmée' | 'En transit' | 'Livrée' | 'Rejetée';

const STATUS_MAP: Record<OrderLineStatus, string> = {
  [OrderLineStatus.PENDING]: 'En attente',
  [OrderLineStatus.CONFIRMED]: 'Confirmée',
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OrderStatusFilter>('Toutes');
  const [selectedOrder, setSelectedOrder] = useState<OrderLineExtended | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Queries
  const { data: orderLines, refetch } = useQuery(getSellerOrdersQuery());

  // Mutations
  const confirmLine = useMutation({
    mutationFn: (args: { orderId: string; lineId: string }) =>
      confirmOrderLineMutation(args.orderId, args.lineId).mutationFn(),
    onSuccess: () => {
      addToast('Commande confirmée avec succès.', 'success');
      setSelectedOrder(null);
      void refetch();
    },
  });

  const rejectLine = useMutation({
    mutationFn: (args: { orderId: string; lineId: string; reason: string }) =>
      rejectOrderLineMutation(args.orderId, args.lineId).mutationFn({ reason: args.reason }),
    onSuccess: () => {
      addToast('Commande rejetée.', 'info');
      setSelectedOrder(null);
      setShowRejectForm(false);
      setRejectReason('');
      void refetch();
    },
  });

  const shipLines = useMutation({
    mutationFn: (orderId: string) => shipOrderLinesMutation(orderId).mutationFn(),
    onSuccess: () => {
      addToast('Commande marquée comme expédiée.', 'success');
      setSelectedOrder(null);
      void refetch();
    },
  });

  const deliverLines = useMutation({
    mutationFn: (orderId: string) => deliverOrderLinesMutation(orderId).mutationFn(),
    onSuccess: () => {
      addToast('Commande marquée comme livrée.', 'success');
      setSelectedOrder(null);
      void refetch();
    },
  });

  const extendedLines: OrderLineExtended[] = (orderLines || []).map((line) => {
    const address = line.order?.deliveryAddress;
    const locationStr = address ? `${address.city}, ${address.country}` : 'Adresse non spécifiée';
    return {
      id: line.id,
      orderId: line.orderId,
      productName: line.harvest?.product?.name || 'Produit inconnu',
      buyerLabel: `Client #${line.order?.buyerId?.slice(0, 4) || 'Anon'}`,
      location: locationStr,
      status: line.status,
      weight: `${line.quantity} kg`,
      price: `${Number(line.totalPrice).toLocaleString()} FCFA`,
      totalPrice: Number(line.totalPrice),
      imgUrl: line.harvest?.photoUrls?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100',
      notes: line.order?.notes || null,
      rejectionReason: line.rejectionReason,
    };
  });

  const filteredOrders = extendedLines.filter((order) => {
    const matchedStatusText = STATUS_MAP[order.status];
    const matchesFilter = activeFilter === 'Toutes' || matchedStatusText === activeFilter;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    <div className="max-w-[480px] mx-auto min-h-screen bg-background relative pb-24 font-sans text-on-surface">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-outline-variant max-w-[480px] mx-auto shadow-sm">
        <div className="flex justify-between items-center px-4 h-16 w-full">
          <div className="flex items-center gap-4">
            <Link to="/farmer/dashboard" className="material-symbols-outlined text-primary cursor-pointer">
              arrow_back
            </Link>
            <h1 className="text-sm font-bold text-primary">Mes commandes</h1>
          </div>
          <button
            onClick={() => void refetch()}
            className="material-symbols-outlined text-on-surface-variant cursor-pointer p-2 rounded-full hover:bg-surface-container-low transition-colors"
          >
            refresh
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-20 px-4 space-y-6">
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
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
            search
          </span>
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
          {(['Toutes', 'En attente', 'Confirmée', 'En transit', 'Livrée', 'Rejetée'] as const).map((filter) => {
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
              <div key={order.id} className="bg-white rounded-xl p-4 border border-outline-variant space-y-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-primary font-bold text-xs">Réf : {order.id.slice(0, 8)}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
                    {matchedStatusText}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <img className="w-10 h-10 rounded-lg object-cover bg-surface-container-low border border-outline-variant/30" alt={order.productName} src={order.imgUrl} />
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
                    onClick={() => setSelectedOrder(order)}
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

      {/* Details Modal Overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 text-on-surface shadow-2xl relative">
            <button
              onClick={() => {
                setSelectedOrder(null);
                setShowRejectForm(false);
              }}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <h3 className="font-display text-base font-bold text-primary">Commande {selectedOrder.id.slice(0, 8)}</h3>
            <div className="flex items-center gap-4 border-b border-outline-variant/30 pb-4">
              <img className="w-12 h-12 rounded-lg object-cover" alt={selectedOrder.productName} src={selectedOrder.imgUrl} />
              <div>
                <h4 className="font-bold text-sm">{selectedOrder.productName}</h4>
                <p className="text-xs text-on-surface-variant">Statut : <span className="font-bold text-primary">{STATUS_MAP[selectedOrder.status]}</span></p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Client :</span>
                <span className="font-bold">{selectedOrder.buyerLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Adresse :</span>
                <span className="font-bold">{selectedOrder.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Quantité commandée :</span>
                <span className="font-bold">{selectedOrder.weight}</span>
              </div>
              {selectedOrder.notes && (
                <div className="bg-surface-container-low p-2 rounded text-outline italic">
                  Notes : "{selectedOrder.notes}"
                </div>
              )}
              {selectedOrder.status === OrderLineStatus.REJECTED && selectedOrder.rejectionReason && (
                <div className="bg-rose-50 text-rose-800 p-2 rounded border border-rose-100">
                  Motif du rejet : "{selectedOrder.rejectionReason}"
                </div>
              )}
              <div className="flex justify-between border-t border-outline-variant/30 pt-2 text-sm">
                <span className="font-bold text-primary">Montant total :</span>
                <span className="font-black text-primary">{selectedOrder.price}</span>
              </div>
            </div>

            {/* Action controls based on line status */}
            {!showRejectForm ? (
              <div className="pt-2 flex gap-2">
                {selectedOrder.status === OrderLineStatus.PENDING && (
                  <>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 py-2.5 border border-error text-error rounded-xl text-xs font-bold hover:bg-rose-50 active:scale-95 cursor-pointer"
                    >
                      Rejeter
                    </button>
                    <button
                      onClick={() => confirmLine.mutate({ orderId: selectedOrder.orderId, lineId: selectedOrder.id })}
                      disabled={confirmLine.isPending}
                      className="flex-[2] py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {confirmLine.isPending ? 'Confirmation...' : 'Confirmer le lot'}
                    </button>
                  </>
                )}
                {selectedOrder.status === OrderLineStatus.CONFIRMED && (
                  <button
                    onClick={() => shipLines.mutate(selectedOrder.orderId)}
                    disabled={shipLines.isPending}
                    className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {shipLines.isPending ? 'Expédition...' : "Confirmer l'expédition"}
                  </button>
                )}
                {selectedOrder.status === OrderLineStatus.SHIPPED && (
                  <button
                    onClick={() => deliverLines.mutate(selectedOrder.orderId)}
                    disabled={deliverLines.isPending}
                    className="w-full py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {deliverLines.isPending ? 'Livraison...' : 'Confirmer la livraison'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2 animate-fadeIn">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Veuillez spécifier le motif du rejet (requis)..."
                  className="w-full border border-outline-variant p-2 rounded-xl text-xs focus:ring-1 focus:ring-primary outline-none"
                  required
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="flex-1 py-2 bg-outline-variant/30 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => rejectLine.mutate({ orderId: selectedOrder.orderId, lineId: selectedOrder.id, reason: rejectReason })}
                    disabled={rejectLine.isPending || !rejectReason}
                    className="flex-1 py-2 bg-error text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {rejectLine.isPending ? 'Rejet...' : 'Soumettre'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-outline-variant max-w-[480px] mx-auto shadow-lg">
        <div className="flex justify-around items-center h-16 w-full">
          <Link
            to="/farmer/dashboard"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px] font-bold">Accueil</span>
          </Link>
          <Link
            to="/farmer/stock"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">grass</span>
            <span className="text-[10px] font-bold">Stock</span>
          </Link>
          <Link
            to="/farmer/harvests/analyze"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">gavel</span>
            <span className="text-[10px] font-bold">Enchères</span>
          </Link>
          <Link
            to="/farmer/orders"
            className="flex flex-col items-center justify-center text-primary font-bold transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              shopping_cart
            </span>
            <span className="text-[10px] font-bold">Commandes</span>
          </Link>
          <Link
            to="/farmer/profile"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-bold">Profil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
