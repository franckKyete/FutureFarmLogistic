import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrderDetailsQuery,
  confirmOrderLineMutation,
  rejectOrderLineMutation,
} from '@/features/orders/api/orders.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';
import { formatPriceDirect } from '@/features/currency/store/currency.store';
import { OrderLineStatus, OrderStatus } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/orders/$id')({
  component: FarmerOrderDetailPage,
});

const CATEGORY_MAP: Record<string, string> = {
  VEGETABLES: 'MARAÎCHAGE',
  FRUITS: 'FRUITS',
  CEREALS: 'CÉRÉALES',
  TUBERS: 'TUBERCULES',
  LEGUMES: 'LÉGUMINEUSES',
  SPICES: 'ÉPICES',
  OTHER: 'PRODUIT AGRICOLE',
};

function formatOrderDate(dateString: string | Date | undefined): string {
  if (!dateString) return 'Date inconnue';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Date inconnue';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(':', 'h');
}

function getInitials(name?: string): string {
  if (!name) return 'CL';
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'CL';
}

export function FarmerOrderDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Queries
  const { data: order, isLoading, error, refetch } = useQuery(getOrderDetailsQuery(id));

  // Mutations
  const confirmLine = useMutation({
    mutationFn: (args: { orderId: string; lineId: string }) =>
      confirmOrderLineMutation(args.orderId, args.lineId).mutationFn(),
    onSuccess: (updatedOrder) => {
      addToast('Commande confirmée avec succès.', 'success');
      if (updatedOrder) {
        queryClient.setQueryData(['orders', id], updatedOrder);
      }
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      void refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Erreur lors de la confirmation';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const rejectLine = useMutation({
    mutationFn: (args: { orderId: string; lineId: string; reason: string }) =>
      rejectOrderLineMutation(args.orderId, args.lineId).mutationFn({ reason: args.reason }),
    onSuccess: (updatedOrder) => {
      addToast('Commande rejetée.', 'info');
      setShowRejectModal(false);
      setRejectReason('');
      if (updatedOrder) {
        queryClient.setQueryData(['orders', id], updatedOrder);
      }
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'seller'] });
      void refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Erreur lors du rejet';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  // Calculate overall status for the farmer's items
  const primaryLine = order?.lines?.[0];
  const isConfirmed =
    order?.status === OrderStatus.CONFIRMED ||
    (order?.lines && order.lines.length > 0 && order.lines.every((l) => l.status === OrderLineStatus.CONFIRMED));

  const isShipped =
    order?.status === OrderStatus.SHIPPED ||
    (order?.lines && order.lines.length > 0 && order.lines.every((l) => l.status === OrderLineStatus.SHIPPED));

  const isDelivered =
    order?.status === OrderStatus.DELIVERED ||
    (order?.lines && order.lines.length > 0 && order.lines.every((l) => l.status === OrderLineStatus.DELIVERED));

  const isRejected =
    (order?.lines && order.lines.length > 0 && order.lines.every((l) => l.status === OrderLineStatus.REJECTED));

  const overallLineStatus: OrderLineStatus =
    isDelivered
      ? OrderLineStatus.DELIVERED
      : isShipped
        ? OrderLineStatus.SHIPPED
        : isConfirmed
          ? OrderLineStatus.CONFIRMED
          : isRejected
            ? OrderLineStatus.REJECTED
            : primaryLine?.status || OrderLineStatus.PENDING;

  // Header status configuration
  const statusBadge = useMemo(() => {
    switch (overallLineStatus) {
      case OrderLineStatus.CONFIRMED:
        return { label: 'Prêt pour la collecte', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case OrderLineStatus.SHIPPED:
        return { label: 'En transit', className: 'bg-blue-50 text-blue-800 border-blue-200' };
      case OrderLineStatus.DELIVERED:
        return { label: 'Livrée', className: 'bg-gray-100 text-gray-700 border-gray-200' };
      case OrderLineStatus.REJECTED:
        return { label: 'Rejetée', className: 'bg-rose-50 text-rose-800 border-rose-200' };
      default:
        if (order?.status === OrderStatus.CANCELLED) {
          return { label: 'Annulée', className: 'bg-rose-50 text-rose-800 border-rose-200' };
        }
        if (order?.status === OrderStatus.CONFIRMED) {
          return { label: 'Prêt pour la collecte', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
        }
        return { label: 'En attente de confirmation', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
  }, [overallLineStatus, order?.status]);

  const rightAction = useMemo(
    () => (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.className}`}>
        {statusBadge.label}
      </span>
    ),
    [statusBadge.className, statusBadge.label],
  );

  useFarmerLayout({
    title: `Commande #${id.slice(0, 8)}`,
    showBack: true,
    backTo: '/farmer/orders',
    hideBottomNav: true,
    rightAction,
  });

  if (isLoading) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9fc] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#004322] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9fc] p-6 text-center space-y-4 pt-16">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
          <Icon name="error" className="text-2xl" />
        </div>
        <h2 className="text-base font-bold text-gray-900">Commande introuvable</h2>
        <p className="text-xs text-gray-500">Cette commande n'existe pas ou n'est plus accessible.</p>
        <button
          onClick={() => void navigate({ to: '/farmer/orders' })}
          className="px-4 py-2 bg-[#004322] text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-[#1a5c35]"
        >
          Retour aux commandes
        </button>
      </div>
    );
  }

  // Buyer Info
  const buyerName =
    order.buyer?.firstName && order.buyer?.lastName
      ? `${order.buyer.firstName} ${order.buyer.lastName}`
      : order.deliveryAddress?.recipientName || `Client #${order.buyerId.slice(0, 4)}`;

  const buyerLocation = order.deliveryAddress
    ? `${order.deliveryAddress.city}, ${order.deliveryAddress.country}`
    : 'Emplacement non renseigné';

  const buyerPhone = order.deliveryAddress?.phoneNumber || order.buyer?.phoneNumber || '';
  const buyerEmail = order.buyer?.email || '';

  // Extract delivery notes / slot
  const deliveryNotes = order.notes || '';

  // Driver details (displayed whenever assigned)
  const deliveryInfo = (order as any).delivery;
  const deliveryDriverName = deliveryInfo?.driverName || null;
  const deliveryDriverPhone = deliveryInfo?.driverPhone || null;
  const deliveryDriverAvatar = deliveryInfo?.driverAvatarUrl || null;
  const deliveryVehiclePlate = deliveryInfo?.vehiclePlate || null;
  const deliveryVehicleType = deliveryInfo?.vehicleType || null;
  const hasAssignedDriver = Boolean(deliveryDriverName);

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9fc] text-[#0b1c30] font-sans pb-36 pt-4 px-4 space-y-4">
      {/* ── 1. PRODUCT / CROP HERO CARDS ── */}
      {(order.lines || []).map((line) => {
        const harvest = line.harvest;
        const product = harvest?.product;
        const productName = product?.name || 'Produit récolté';
        const categoryKey = (product?.category || 'OTHER').toUpperCase();
        const categoryLabel = CATEGORY_MAP[categoryKey] || categoryKey;
        const photoUrl =
          harvest?.photoUrls?.[0] ||
          'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=600';
        const unit = harvest?.unit || 'kg';
        const currency = line.currency || order.currency || 'CDF';

        return (
          <div
            key={line.id}
            className="bg-white rounded-3xl border border-[#e2e8f0] overflow-hidden shadow-sm space-y-0"
          >
            {/* Top Crop Photo */}
            <div className="relative w-full h-52 sm:h-60 bg-gray-100 overflow-hidden">
              <img
                src={photoUrl}
                alt={productName}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Card Details */}
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block bg-[#e0f2fe] text-[#0369a1] text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider">
                      {categoryLabel}
                    </span>
                    {line.status === OrderLineStatus.CONFIRMED || order?.status === OrderStatus.CONFIRMED ? (
                      <span className="inline-flex items-center gap-1 bg-[#e6f4ea] text-[#004322] border border-[#aef2be] text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
                        <Icon name="check_circle" className="text-[13px] text-[#004322]" />
                        <span>Prêt pour la collecte</span>
                      </span>
                    ) : line.status === OrderLineStatus.SHIPPED ? (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        <Icon name="local_shipping" className="text-[13px]" />
                        <span>En transit</span>
                      </span>
                    ) : line.status === OrderLineStatus.DELIVERED ? (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        <Icon name="check" className="text-[13px]" />
                        <span>Livré</span>
                      </span>
                    ) : line.status === OrderLineStatus.REJECTED ? (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        <Icon name="cancel" className="text-[13px]" />
                        <span>Rejeté</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        <Icon name="schedule" className="text-[13px]" />
                        <span>En attente de confirmation</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-[#0b1c30] leading-tight truncate">
                    {productName}
                  </h2>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-semibold text-[#707970] block">
                    Quantité
                  </span>
                  <span className="text-xl font-black text-[#0b1c30]">
                    {Number(line.quantity).toLocaleString()} {unit}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#707970]">
                  Prix unitaire: {formatPriceDirect(Number(line.unitPrice), currency)}/{unit}
                </span>
                <span className="text-lg font-black text-[#004322]">
                  {formatPriceDirect(Number(line.totalPrice), currency)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── 2. ACHETEUR CARD ── */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[#707970] uppercase tracking-wider px-1">
          Acheteur
        </h3>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[#1a5c35] text-white flex items-center justify-center font-black text-base uppercase shrink-0 shadow-sm">
              {getInitials(buyerName)}
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-[#0b1c30] truncate">{buyerName}</h4>
              <p className="text-xs text-[#707970] truncate">{buyerLocation}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="px-4 py-2 rounded-xl border border-[#cbd5e1] hover:border-[#1a5c35] text-[#1a5c35] hover:bg-[#1a5c35]/5 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
          >
            Contacter
          </button>
        </div>
      </div>

      {/* ── 3. MODE DE LIVRAISON CARD ── */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[#707970] uppercase tracking-wider px-1">
          Mode de livraison
        </h3>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="local_shipping" className="text-[18px] text-[#9a3412]" />
            <span className="bg-[#fff7ed] text-[#9a3412] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[#ffedd5]">
              Transporteur propre
            </span>
          </div>

          {hasAssignedDriver && deliveryDriverName ? (
            <div data-testid="farmer-driver-card" className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                {deliveryDriverAvatar ? (
                  <img
                    src={deliveryDriverAvatar}
                    alt={deliveryDriverName}
                    className="w-11 h-11 rounded-xl object-cover border border-[#bbf7d0] shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-[#004322] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                    {getInitials(deliveryDriverName)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-[#0b1c30] truncate">{deliveryDriverName}</p>
                    <span className="bg-emerald-100 text-[#004322] text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                      Chauffeur assigné
                    </span>
                  </div>
                  <p className="text-[11px] text-[#707970] truncate mt-0.5">
                    {deliveryVehiclePlate
                      ? `Véhicule : ${deliveryVehicleType ? `${deliveryVehicleType} • ` : ''}${deliveryVehiclePlate}`
                      : deliveryDriverPhone || 'Transporteur Future Farm'}
                  </p>
                </div>
              </div>

              {deliveryDriverPhone && (
                <a
                  href={`tel:${deliveryDriverPhone}`}
                  className="w-9 h-9 rounded-full bg-white text-[#004322] flex items-center justify-center border border-[#bbf7d0] hover:bg-[#004322] hover:text-white transition-colors shrink-0 shadow-xs"
                  title="Appeler le chauffeur"
                  data-testid="farmer-driver-phone-btn"
                >
                  <Icon name="phone" className="text-[18px]" />
                </a>
              )}
            </div>
          ) : (
            <div className="bg-[#f8f9fc] border border-[#e2e8f0] rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-white text-[#707970] flex items-center justify-center border border-gray-200 shrink-0 shadow-xs mt-0.5">
                <Icon name="schedule" className="text-[20px]" />
              </div>
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-[#0b1c30]">Chauffeur en cours d'attribution</p>
                <p className="text-[11px] text-[#707970] leading-relaxed">
                  Le chauffeur ou transporteur sera automatiquement désigné pour la collecte de votre lot.
                </p>
              </div>
            </div>
          )}

          {deliveryNotes && (
            <div className="text-[11px] text-[#707970] bg-[#f8f9fc] p-2.5 rounded-xl border border-gray-100 italic">
              <span className="font-semibold not-italic text-[#404941]">Notes de commande :</span> {deliveryNotes}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. SUIVI DE COMMANDE STEPPER ── */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold text-[#707970] uppercase tracking-wider px-1">
          Suivi de commande
        </h3>
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm space-y-4">
          {/* Step 1: Commande passée */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                <Icon name="check" className="text-[15px]" />
              </div>
              <div className="w-[2px] h-8 bg-[#1a5c35] my-0.5" />
            </div>
            <div className="pt-0.5">
              <p className="text-xs font-bold text-[#0b1c30]">Commande passée</p>
              <p className="text-[11px] text-[#707970]">{formatOrderDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Step 2: Paiement confirmé */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                <Icon name="check" className="text-[15px]" />
              </div>
              <div className="w-[2px] h-8 bg-[#1a5c35] my-0.5" />
            </div>
            <div className="pt-0.5">
              <p className="text-xs font-bold text-[#0b1c30]">Paiement confirmé</p>
              <p className="text-[11px] text-[#707970]">{formatOrderDate(order.createdAt)}</p>
            </div>
          </div>

          {/* Step 3: Préparation en cours */}
          <div className="flex items-start gap-3 relative">
            <div className="flex flex-col items-center">
              {overallLineStatus === OrderLineStatus.CONFIRMED ||
              overallLineStatus === OrderLineStatus.SHIPPED ||
              overallLineStatus === OrderLineStatus.DELIVERED ? (
                <div className="w-6 h-6 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                  <Icon name="check" className="text-[15px]" />
                </div>
              ) : overallLineStatus === OrderLineStatus.REJECTED ? (
                <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                  <Icon name="close" className="text-[15px]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                </div>
              )}
              <div
                className={`w-[2px] h-8 my-0.5 ${
                  overallLineStatus === OrderLineStatus.SHIPPED || overallLineStatus === OrderLineStatus.DELIVERED
                    ? 'bg-[#1a5c35]'
                    : 'bg-gray-200'
                }`}
              />
            </div>
            <div className="pt-0.5">
              <p className="text-xs font-bold text-[#0b1c30]">Préparation en cours</p>
              <p className="text-[11px] text-[#707970]">
                {overallLineStatus === OrderLineStatus.PENDING
                  ? 'En attente de confirmation producteur...'
                  : overallLineStatus === OrderLineStatus.CONFIRMED
                    ? 'Prêt pour expédition'
                    : overallLineStatus === OrderLineStatus.REJECTED
                      ? 'Lot refusé'
                      : 'Terminé'}
              </p>
            </div>
          </div>

          {/* Step 4: Expédition */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {overallLineStatus === OrderLineStatus.SHIPPED || overallLineStatus === OrderLineStatus.DELIVERED ? (
                <div className="w-6 h-6 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shrink-0 shadow-xs z-10">
                  <Icon name="check" className="text-[15px]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-300 text-gray-400 flex items-center justify-center shrink-0 z-10" />
              )}
            </div>
            <div className="pt-0.5">
              <p className="text-xs font-bold text-[#0b1c30]">Expédition</p>
              <p className="text-[11px] text-[#707970]">
                {overallLineStatus === OrderLineStatus.SHIPPED
                  ? 'En cours d’acheminement'
                  : overallLineStatus === OrderLineStatus.DELIVERED
                    ? 'Expédiée et livrée'
                    : 'À venir'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. STATUS / REJECTION NOTICES IF CANCELLED OR REJECTED ── */}
      {overallLineStatus === OrderLineStatus.REJECTED && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1 text-xs text-rose-900 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <Icon name="cancel" className="text-[18px]" />
            <span>Lot rejeté par votre exploitation</span>
          </div>
          {primaryLine?.rejectionReason && (
            <p className="text-[11px] text-rose-700 pl-6">
              Motif : « {primaryLine.rejectionReason} »
            </p>
          )}
        </div>
      )}

      {order.status === OrderStatus.CANCELLED && overallLineStatus !== OrderLineStatus.REJECTED && (
        <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4 text-xs text-gray-800 shadow-sm flex items-center gap-2">
          <Icon name="info" className="text-gray-600 text-[18px]" />
          <span className="font-bold">Cette commande a été annulée par l'acheteur.</span>
        </div>
      )}

      {overallLineStatus === OrderLineStatus.DELIVERED && (
        <div className="bg-[#e6f4ea] border border-[#aef2be] rounded-2xl p-4 text-xs text-[#004322] shadow-sm flex items-center justify-center gap-2 font-bold">
          <Icon name="check_circle" className="text-[20px]" />
          <span>Commande livrée et clôturée avec succès</span>
        </div>
      )}

      {/* ── 6. FIXED BOTTOM ACTION BAR ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e2e8f0] p-4 shadow-xl">
        <div className="max-w-[480px] mx-auto space-y-2.5">
          {/* Action State 1: PENDING -> Confirmer le lot / Rejeter */}
          {overallLineStatus === OrderLineStatus.PENDING &&
            order.status !== OrderStatus.CANCELLED &&
            order.status !== OrderStatus.CONFIRMED && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => primaryLine && confirmLine.mutate({ orderId: order.id, lineId: primaryLine.id })}
                disabled={confirmLine.isPending || !primaryLine}
                className="w-full py-4 px-4 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                {confirmLine.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Confirmation en cours...</span>
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" className="text-[20px]" />
                    <span>Confirmer le lot</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={rejectLine.isPending}
                className="w-full py-3 px-4 border border-[#b91c1c] hover:bg-rose-50 text-[#b91c1c] font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 shadow-xs"
              >
                <span>Rejeter la commande</span>
              </button>
            </div>
          )}

          {/* Action State 2: CONFIRMED -> Prêt pour la collecte */}
          {(overallLineStatus === OrderLineStatus.CONFIRMED || order.status === OrderStatus.CONFIRMED) && (
            <div className="space-y-2">
              <div
                data-testid="farmer-ready-pickup-indicator"
                className="py-3.5 px-4 bg-[#e6f4ea] border border-[#aef2be] rounded-2xl text-center text-sm font-bold text-[#004322] flex items-center justify-center gap-2 shadow-xs"
              >
                <Icon name="check_circle" className="text-[20px] text-[#004322]" />
                <span>Prêt pour la collecte</span>
              </div>

              <Link
                to="/farmer/orders"
                className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-[#707970] hover:text-[#0b1c30] font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Icon name="arrow_back" className="text-[16px]" />
                <span>Retour à la liste des commandes</span>
              </Link>
            </div>
          )}

          {/* Action State 3: SHIPPED (Picked up) -> Info badge + Return to orders button, no action buttons */}
          {overallLineStatus === OrderLineStatus.SHIPPED && (
            <div className="space-y-2">
              <div className="p-3.5 bg-[#eff6ff] border border-[#bfdbfe] rounded-2xl text-center text-xs font-bold text-[#1e40af] flex items-center justify-center gap-2 shadow-xs">
                <Icon name="local_shipping" className="text-[20px]" />
                <span>Commande prise en charge et en cours d'acheminement</span>
              </div>
              <Link
                to="/farmer/orders"
                className="w-full py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
              >
                <span>Retour à la liste des commandes</span>
              </Link>
            </div>
          )}

          {/* Action State 4: DELIVERED, REJECTED or CANCELLED -> Simple Return Button */}
          {(overallLineStatus === OrderLineStatus.DELIVERED ||
            overallLineStatus === OrderLineStatus.REJECTED ||
            order.status === OrderStatus.CANCELLED) && (
            <Link
              to="/farmer/orders"
              className="w-full py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-[#0b1c30] font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <span>Retour à la liste des commandes</span>
            </Link>
          )}
        </div>
      </footer>

      {/* ── REJECTION MODAL ── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <Icon name="close" className="text-lg" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">Rejeter le lot</h3>
              <p className="text-xs text-gray-500">
                Veuillez indiquer le motif du rejet pour informer l'acheteur et initier le remboursement.
              </p>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Rupture de stock, problème de transport, qualité insuffisante..."
              rows={3}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none transition-all resize-none"
              required
            />

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || rejectLine.isPending || !primaryLine}
                onClick={() =>
                  primaryLine &&
                  rejectLine.mutate({
                    orderId: order.id,
                    lineId: primaryLine.id,
                    reason: rejectReason.trim(),
                  })
                }
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors shadow-sm"
              >
                {rejectLine.isPending ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT ISSUE MODAL ── */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowIssueModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <Icon name="close" className="text-lg" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Icon name="report_problem" className="text-2xl" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Signaler un problème</h3>
                <p className="text-[11px] text-gray-500">Support FutureFarm Logistics</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Un litige sur cette expédition ou un retard de transporteur ? Notre équipe d'assistance logistique est disponible 24/7.
            </p>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1.5">
              <p className="font-semibold text-gray-800">Support Téléphonique :</p>
              <p className="font-mono text-[#004322] font-bold">+243 81 000 0000</p>
              <p className="font-semibold text-gray-800 pt-1">Email :</p>
              <p className="text-gray-600">support@futurefarm.io</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowIssueModal(false);
                  addToast('Votre signalement a été transmis à notre équipe support.', 'info');
                }}
                className="w-full py-2.5 bg-[#004322] hover:bg-[#1a5c35] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
              >
                Transmettre une réclamation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONTACT BUYER MODAL ── */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <Icon name="close" className="text-lg" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e6f4ea] text-[#004322] flex items-center justify-center shrink-0">
                <Icon name="contact_phone" className="text-2xl" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Coordonnées de l'acheteur</h3>
                <p className="text-[11px] text-gray-500">{buyerName}</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {buyerPhone && (
                <a
                  href={`tel:${buyerPhone}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#cbd5e1] hover:border-[#004322] bg-[#f8f9fc] hover:bg-white text-xs font-bold text-[#004322] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="call" className="text-[18px]" />
                    <span>Appeler : {buyerPhone}</span>
                  </div>
                  <Icon name="arrow_forward" className="text-[16px]" />
                </a>
              )}

              {buyerEmail && (
                <a
                  href={`mailto:${buyerEmail}?subject=Commande%20%23${order.id.slice(0, 8)}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#cbd5e1] hover:border-[#004322] bg-[#f8f9fc] hover:bg-white text-xs font-bold text-[#004322] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Icon name="mail" className="text-[18px]" />
                    <span className="truncate max-w-[180px]">Email : {buyerEmail}</span>
                  </div>
                  <Icon name="arrow_forward" className="text-[16px]" />
                </a>
              )}

              {!buyerPhone && !buyerEmail && (
                <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl">
                  Coordonnées directes non disponibles. Veuillez contacter le support en cas de besoin.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
