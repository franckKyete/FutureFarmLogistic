import { Icon } from '@/features/shared/components/Icon';
import { useState, useEffect } from 'react';
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
  useNavigate,
} from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrderDetailsQuery,
  cancelOrderMutation,
  retryPaymentMutation,
} from '@/features/orders/api/buyer-orders.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { addToast } from '@/features/shared/store/toast.store';
import { apiClient } from '@/lib/api-client';
import { formatPriceDirect } from '@/features/currency/store/currency.store';
import { OrderStatus, OrderLineStatus, PaymentStatus, type FarmerProfileDto, type OrderPartySummaryDto } from '@futurefarm/types';

export const Route = createFileRoute('/orders/$id')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    session_id?: string;
    checkoutId?: string;
    checkoutCode?: string;
    payment_failed?: string;
  } => {
    const res: {
      session_id?: string;
      checkoutId?: string;
      checkoutCode?: string;
      payment_failed?: string;
    } = {};
    if (typeof search['session_id'] === 'string' && search['session_id']) {
      res.session_id = search['session_id'];
    }
    if (typeof search['checkoutId'] === 'string' && search['checkoutId']) {
      res.checkoutId = search['checkoutId'];
    }
    if (typeof search['checkoutCode'] === 'string' && search['checkoutCode']) {
      res.checkoutCode = search['checkoutCode'];
    }
    if (
      typeof search['payment_failed'] === 'string' &&
      search['payment_failed']
    ) {
      res.payment_failed = search['payment_failed'];
    }
    return res;
  },
  beforeLoad: () => {
    requireAuth();
  },
  component: OrderDetailPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  VEGETABLES: 'MARAÎCHAGE',
  FRUITS: 'FRUITS',
  CEREALS: 'CÉRÉALES',
  TUBERS: 'TUBERCULES',
  LEGUMES: 'LÉGUMINEUSES',
  OTHER: 'AUTRE',
};

const STATUS_BADGE: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  [OrderStatus.PENDING_PAYMENT]: {
    label: 'Paiement en attente',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  [OrderStatus.AWAITING_CONFIRMATION]: {
    label: 'Payée • En préparation',
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  },
  [OrderStatus.CONFIRMED]: {
    label: 'Confirmée',
    className: 'bg-[#e6f4ea] text-[#004322] border border-emerald-200',
  },
  [OrderStatus.SHIPPED]: {
    label: 'Expédiée',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  [OrderStatus.DELIVERED]: {
    label: 'Livrée',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  [OrderStatus.CANCELLED]: {
    label: 'Annulée',
    className: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
};

const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80';

function formatPrice(amount: number, currency = 'USD'): string {
  return formatPriceDirect(amount, currency);
}

function formatDateTimeline(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc',
    ];
    const month = months[d.getMonth()] ?? '';
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} • ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return (name.slice(0, 2) || 'FF').toUpperCase();
}

export function OrderDetailPage() {
  const { id } = Route.useParams();
  const { session_id, checkoutId, checkoutCode, payment_failed } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routerState = useRouterState();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async (orderId: string) => {
    try {
      setIsDownloadingPdf(true);
      const response = await apiClient.get<Blob>(`/orders/${orderId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bon-de-commande-ORD-${orderId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('Bon de commande téléchargé.', 'success');
    } catch {
      addToast('Erreur lors du téléchargement du bon de commande.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const matches = routerState.matches;
  const isChildRoute = matches.some(
    (m) => m.routeId !== '/orders/$id' && m.routeId.startsWith('/orders/$id/'),
  );

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery(getOrderDetailsQuery(id));

  const cancelOrder = useMutation({
    mutationFn: () => cancelOrderMutation().mutationFn(id),
    onSuccess: () => {
      addToast('Commande annulée avec succès.', 'success');
      setShowCancelConfirm(false);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      addToast("Erreur lors de l'annulation de la commande.", 'error');
    },
  });

  const retryPayment = useMutation({
    mutationFn: () => retryPaymentMutation().mutationFn(order?.id || id),
    onSuccess: (data) => {
      addToast('Redirection vers la plateforme de paiement...', 'info');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    },
    onError: () => {
      addToast('Erreur lors de la relance du paiement.', 'error');
    },
  });

  useEffect(() => {
    if ((session_id || checkoutId || checkoutCode) && order?.paymentStatus === 'PAID') {
      void navigate({ to: '/orders/$id', params: { id }, replace: true, search: {} });
    }
  }, [session_id, checkoutId, checkoutCode, order?.paymentStatus, navigate, id]);

  if (isLoading) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
          <Link to="/orders" className="p-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center">
            <Icon name="arrow_back" className="text-[22px]" />
          </Link>
          <span className="text-sm font-bold text-[#0b1c30]">Chargement...</span>
          <div className="w-8" />
        </header>
        <main className="pt-20 px-4 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#004322] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#707970]">Récupération des détails de commande...</p>
        </main>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
          <Link to="/orders" className="p-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center">
            <Icon name="arrow_back" className="text-[22px]" />
          </Link>
          <span className="text-sm font-bold text-[#0b1c30]">Commande</span>
          <div className="w-8" />
        </header>
        <main className="pt-20 px-4">
          <div className="py-16 text-center bg-white rounded-2xl border border-[#c0c9be] p-6 shadow-sm">
            <Icon name="error_outline" className="text-4xl text-gray-400 mb-2 block" />
            <p className="text-sm text-[#0b1c30] font-bold">Commande introuvable</p>
            <p className="text-xs text-[#707970] mt-1">
              Cette commande n&apos;existe pas ou a été archivée.
            </p>
            <Link
              to="/orders"
              className="mt-4 inline-block px-4 py-2 bg-[#004322] text-white text-xs font-bold rounded-xl"
            >
              Retour aux commandes
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Stepper timeline milestones
  const isPaid =
    order.paymentStatus === 'PAID' ||
    order.status === OrderStatus.CONFIRMED ||
    order.status === OrderStatus.SHIPPED ||
    order.status === OrderStatus.DELIVERED;

  const isPaymentFailed =
    !isPaid &&
    (order.paymentStatus === PaymentStatus.FAILED ||
      payment_failed === 'true' ||
      payment_failed === '1');

  const badge = isPaymentFailed
    ? {
        label: 'Paiement échoué',
        className: 'bg-rose-50 text-rose-800 border border-rose-200',
      }
    : STATUS_BADGE[order.status] ?? {
        label: order.status,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      };

  if (isChildRoute) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <Outlet />
      </div>
    );
  }

  // Active order line for single hero showcase
  const activeLine = order.lines[activeLineIdx] ?? order.lines[0];
  const activeHarvest = activeLine?.harvest;
  const activeProduct = activeHarvest?.product;
  const activeCategoryKey = activeProduct?.category ?? 'VEGETABLES';
  const activeCategoryText = CATEGORY_LABEL[activeCategoryKey] ?? activeCategoryKey;
  const activePhotoUrl =
    activeHarvest?.photoUrls && activeHarvest.photoUrls.length > 0
      ? activeHarvest.photoUrls[0]
      : DEFAULT_PRODUCT_IMAGE;

  // Producer & Contact details
  const farmerProfile = (activeLine?.farmerProfile ?? activeHarvest?.farmerProfile) as
    | (FarmerProfileDto & { user?: OrderPartySummaryDto })
    | undefined;
  const farmerUser = farmerProfile?.user;
  const producerName =
    farmerProfile?.companyName ||
    (farmerUser ? `${farmerUser.firstName} ${farmerUser.lastName}`.trim() : '') ||
    'Producteur';
  const producerAddress = farmerProfile?.address || 'Niayes, Sénégal';
  const producerInitials = getInitials(producerName);
  const producerPhone = farmerUser?.phoneNumber || '+221 77 000 00 00';
  const producerEmail = farmerUser?.email || 'contact@futurefarm.sn';
  const producerAvatarUrl = farmerProfile?.avatarUrl;
  const isProducerCertified = !!farmerProfile?.isCertified;
  const producerId = farmerProfile?.id || activeLine?.farmerProfileId;

  // Driver / Delivery details
  // Business rule: Normally a driver cannot be assigned to an order that has not been confirmed yet
  const isOrderConfirmed =
    order.status === OrderStatus.CONFIRMED ||
    order.status === OrderStatus.SHIPPED ||
    order.status === OrderStatus.DELIVERED;

  const driverName = isOrderConfirmed ? order.delivery?.driverName : null;
  const driverPhone = isOrderConfirmed ? order.delivery?.driverPhone : null;
  const deliveryMode = order.delivery?.mode || 'Transporteur propre';

  const isPreparing =
    order.status === OrderStatus.CONFIRMED ||
    order.status === OrderStatus.AWAITING_CONFIRMATION;

  const isShipped =
    order.status === OrderStatus.SHIPPED ||
    order.status === OrderStatus.DELIVERED;

  const isDelivered = order.status === OrderStatus.DELIVERED;

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9fc] text-[#0b1c30] font-sans pb-12">
      {/* ── TOPBAR (Matching Mockup) ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/orders"
            className="p-1 -ml-1 rounded-lg text-[#004322] hover:bg-gray-100 transition-colors flex items-center cursor-pointer"
            aria-label="Retour"
          >
            <Icon name="arrow_back" className="text-[24px]" />
          </Link>
          <h1 className="text-base font-extrabold text-[#004322] tracking-tight">
            Commande #ORD-{order.id.slice(0, 4).toUpperCase()}
          </h1>
        </div>

        <span
          data-testid="order-status-badge"
          className={`px-3 py-1 rounded-full text-xs font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="pt-18 px-4 space-y-4">
        {/* ── AWAITING PAYMENT WEBHOOK BANNER ── */}
        {order.paymentStatus === 'PENDING' && (Boolean(session_id) || Boolean(checkoutId) || Boolean(checkoutCode)) && (
          <div
            data-testid="order-awaiting-webhook-banner"
            className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs animate-pulse"
          >
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <div className="w-4 h-4 border-2 border-amber-800 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-amber-900">
                Paiement en cours de validation par l&apos;opérateur
              </h3>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Votre transaction a été transmise. Dès réception de la confirmation par l&apos;opérateur de paiement (Mobile Money / Stripe), cette page se mettra à jour automatiquement en temps réel.
              </p>
            </div>
          </div>
        )}

        {/* ── PREPARATION NOTICE CARD (When order is paid and awaiting farmer verification) ── */}
        {order.status === OrderStatus.AWAITING_CONFIRMATION && (
          <div
            data-testid="order-preparation-banner"
            className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4 flex items-start gap-3 shadow-xs"
          >
            <div className="w-9 h-9 rounded-full bg-[#dcfce7] text-[#004322] flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="inventory_2" className="text-[20px]" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-[#004322]">
                Commande payée — En cours de préparation
              </h3>
              <p className="text-[11px] text-[#404941] leading-relaxed">
                Paiement validé. Le producteur prépare actuellement votre commande et vérifie que toutes vos récoltes sont complètes et prêtes pour l&apos;expédition.
              </p>
            </div>
          </div>
        )}

        {/* ── 1. PRODUCT / HARVEST CARD (Unified Single Hero Image) ── */}
        <div
          data-testid="order-product-card"
          className="bg-white border border-[#c0c9be] rounded-2xl overflow-hidden shadow-xs"
        >
          {/* Exactly ONE Hero Image Container */}
          <div className="relative h-48 w-full bg-gray-100 overflow-hidden">
            <img
              src={activePhotoUrl}
              alt={activeProduct?.name ?? 'Récolte'}
              className="w-full h-full object-cover transition-all duration-300"
            />
            {/* Category Pill Overlay */}
            <div className="absolute top-3 left-3">
              <span className="bg-[#f1f5f9]/95 backdrop-blur-xs text-[#475569] text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-2xs">
                {activeCategoryText}
              </span>
            </div>
            {/* Multi-item Count Badge */}
            {order.lines.length > 1 && (
              <div className="absolute top-3 right-3">
                <span className="bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-2xs flex items-center gap-1">
                  <Icon name="inventory_2" className="text-[14px]" />
                  <span>{order.lines.length} articles</span>
                </span>
              </div>
            )}
            {/* Indicator Dots for Multiple Items */}
            {order.lines.length > 1 && (
              <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
                {order.lines.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Voir article ${idx + 1}`}
                    onClick={() => setActiveLineIdx(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === activeLineIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Items Breakdown */}
          <div className="p-4 space-y-3">
            {order.lines.length > 1 && (
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider">
                  Articles commandés ({order.lines.length})
                </span>
                <span className="text-[11px] text-[#707970] font-medium">
                  Cliquez sur un article pour prévisualiser
                </span>
              </div>
            )}

            {order.lines.map((line, idx) => {
              const harvest = line.harvest;
              const product = harvest?.product;
              const isSelected = idx === activeLineIdx && order.lines.length > 1;
              const isReady =
                line.status === OrderLineStatus.CONFIRMED ||
                line.status === OrderLineStatus.SHIPPED ||
                line.status === OrderLineStatus.DELIVERED;
              const isRejected = line.status === OrderLineStatus.REJECTED;

              return (
                <div
                  key={line.id || idx}
                  onClick={() => {
                    if (order.lines.length > 1) {
                      setActiveLineIdx(idx);
                    }
                  }}
                  className={`transition-all rounded-xl ${
                    order.lines.length > 1
                      ? isSelected
                        ? 'bg-emerald-50/50 p-2.5 border border-emerald-200 shadow-2xs cursor-pointer'
                        : 'p-2.5 hover:bg-gray-50/80 cursor-pointer border border-transparent'
                      : 'p-2.5 bg-gray-50/40 rounded-xl border border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.lines.length > 1 && (
                          <span className="inline-block text-[#475569] text-[9px] font-extrabold uppercase tracking-wider">
                            {CATEGORY_LABEL[product?.category ?? ''] ?? product?.category ?? 'MARAÎCHAGE'}
                          </span>
                        )}

                        {/* Farmer Item Confirmation Status Badge */}
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300 shadow-3xs">
                            <Icon name="check_circle" className="text-[13px] text-emerald-700 font-black" />
                            <span>Prêt / Confirmé</span>
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-full border border-rose-300 shadow-3xs">
                            <Icon name="cancel" className="text-[13px] text-rose-700 font-black" />
                            <span>Indisponible / Rejeté</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300 shadow-3xs">
                            <Icon name="hourglass_empty" className="text-[13px] text-amber-700 font-black" />
                            <span>En attente producteur</span>
                          </span>
                        )}
                      </div>

                      <h2 className="text-base font-black text-[#0b1c30] leading-snug truncate">
                        {product?.name ?? 'Récolte'}
                      </h2>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-semibold text-[#707970] block">
                        Quantité
                      </span>
                      <span className="text-sm font-black text-[#0b1c30]">
                        {line.quantity.toLocaleString('fr-FR')} {(harvest?.unit ?? 'kg').toLowerCase()}
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-[#e2e8f0] my-2" />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-semibold text-[#404941]">
                      Prix unitaire: {formatPrice(line.unitPrice, line.currency || order.currency)}/{(harvest?.unit ?? 'kg').toLowerCase()}
                    </span>
                    <span className="text-base font-black text-[#004322]">
                      {formatPrice(line.totalPrice, line.currency || order.currency)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Crops Subtotal */}
            <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between">
              <span className="text-xs font-bold text-[#707970]">
                Sous-total récoltes ({order.lines.length} {order.lines.length > 1 ? 'articles' : 'article'})
              </span>
              <span className="text-sm font-bold text-[#0b1c30]">
                {formatPrice(
                  order.lines.reduce((acc, l) => acc + Number(l.totalPrice), 0),
                  order.currency,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ── CARD: DÉTAIL DES FRAIS & SERVICES ADDITIONNELS ── */}
        <div
          data-testid="order-fees-breakdown-card"
          className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
            <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="receipt_long" className="text-[16px] text-[#004322]" />
              <span>Détail du règlement & Services</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {order.currency}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* Crops subtotal row */}
            <div className="flex items-center justify-between text-[#404941]">
              <span>Sous-total récoltes</span>
              <span className="font-semibold text-[#0b1c30]">
                {formatPrice(
                  order.lines.reduce((acc, l) => acc + Number(l.totalPrice), 0),
                  order.currency,
                )}
              </span>
            </div>

            {/* Additional Fees breakdown */}
            {order.fees && order.fees.length > 0 ? (
              order.fees.map((fee, idx) => (
                <div key={idx} className="flex items-center justify-between text-[#404941]">
                  <div className="flex items-center gap-1.5">
                    <Icon name={fee.code.includes('DELIVERY')
                        ? 'local_shipping'
                        : fee.code.includes('TAX') || fee.code.includes('TVA')
                          ? 'percent'
                          : 'handshake'} className="text-[15px] text-[#707970]" />
                    <span>{fee.name}</span>
                  </div>
                  <span className="font-semibold text-[#0b1c30]">
                    {formatPrice(fee.amount, order.currency)}
                  </span>
                </div>
              ))
            ) : null}

            {/* Cancellation fee if applicable */}
            {order.cancellationFee && order.cancellationFee > 0 ? (
              <div className="flex items-center justify-between text-rose-700">
                <span>Frais d&apos;annulation</span>
                <span className="font-semibold">
                  {formatPrice(order.cancellationFee, order.currency)}
                </span>
              </div>
            ) : null}

            {/* Grand Total Divider */}
            <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between">
              <span className="text-sm font-extrabold text-[#0b1c30]">
                Total commande TTC
              </span>
              <span className="text-lg font-black text-[#004322]">
                {formatPrice(order.totalAmount, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2. CARD: PRODUCTEUR ── */}
        <div
          data-testid="order-producer-card"
          className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-3"
        >
          <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider block">
            PRODUCTEUR
          </span>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/farmer/profile"
                search={{ ...(producerId ? { id: producerId } : {}) }}
                className="shrink-0 block group"
                aria-label={`Profil de ${producerName}`}
              >
                {producerAvatarUrl ? (
                  <img
                    src={producerAvatarUrl}
                    alt={producerName}
                    className="w-11 h-11 rounded-full object-cover border border-[#c0c9be]/60 shadow-xs group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#1b4d2e] text-white font-extrabold flex items-center justify-center text-xs tracking-wider shrink-0 shadow-xs group-hover:bg-[#143c24] transition-colors">
                    {producerInitials}
                  </div>
                )}
              </Link>
              <div className="min-w-0">
                <Link
                  to="/farmer/profile"
                  search={{ ...(producerId ? { id: producerId } : {}) }}
                  data-testid="producer-profile-link"
                  className="text-sm font-bold text-[#0b1c30] hover:text-[#004322] hover:underline inline-flex items-center gap-1.5 truncate group cursor-pointer"
                >
                  <span className="truncate group-hover:underline">{producerName}</span>
                  {isProducerCertified && (
                    <Icon name="verified" className="text-[#004322] text-[16px] shrink-0" title="Producteur certifié" />
                  )}
                </Link>
                <p className="text-xs text-[#707970] truncate">
                  {producerAddress}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`mailto:${producerEmail}`}
                aria-label="Envoyer un email au producteur"
                data-testid="producer-email-btn"
                title={`Email : ${producerEmail}`}
                onClick={(e) => {
                  if (!farmerUser?.email && !producerEmail) {
                    e.preventDefault();
                    addToast(`Email du producteur indisponible`, 'info');
                  }
                }}
                className="w-9 h-9 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] text-[#004322] flex items-center justify-center border border-[#c0c9be]/50 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Icon name="mail" className="text-[18px] leading-none" />
              </a>
              <a
                href={`tel:${producerPhone}`}
                aria-label="Appeler le producteur"
                data-testid="producer-phone-btn"
                title={`Téléphone : ${producerPhone}`}
                onClick={(e) => {
                  if (!farmerUser?.phoneNumber && !producerPhone) {
                    e.preventDefault();
                    addToast(`Téléphone du producteur indisponible`, 'info');
                  }
                }}
                className="w-9 h-9 rounded-full bg-[#eff4ff] hover:bg-[#dce9ff] text-[#004322] flex items-center justify-center border border-[#c0c9be]/50 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Icon name="call" className="text-[18px] leading-none" />
              </a>
            </div>
          </div>
        </div>

        {/* ── 3. CARD: MODE DE LIVRAISON ── */}
        <div
          data-testid="order-delivery-card"
          className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-3"
        >
          <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider block">
            MODE DE LIVRAISON
          </span>

          <div className="flex items-center gap-2">
            <Icon name="local_shipping" className="text-[#92400e] text-[20px]" />
            <span className="bg-[#fef3c7] text-[#92400e] text-xs font-bold px-2.5 py-0.5 rounded-md">
              {deliveryMode}
            </span>
          </div>

          {/* Driver Sub-card (Only if driver assigned) */}
          {driverName ? (
            <div className="bg-[#f0f4fc] rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white text-[#707970] flex items-center justify-center shrink-0 border border-[#e2e8f0]">
                  <Icon name="person" className="text-[20px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0b1c30] truncate">
                    {driverName}
                  </p>
                  <p className="text-[11px] text-[#707970] font-medium truncate">
                    {driverPhone}
                  </p>
                </div>
              </div>

              <a
                href={`tel:${driverPhone}`}
                aria-label="Appeler le transporteur"
                className="w-9 h-9 rounded-full bg-white hover:bg-emerald-50 text-[#004322] flex items-center justify-center border border-[#e2e8f0] shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                <Icon name="call" className="text-[18px]" />
              </a>
            </div>
          ) : (
            <div className="bg-[#f8f9fc] border border-[#e2e8f0] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#707970]">
              <Icon name={order.status === OrderStatus.PENDING_PAYMENT
                  ? 'info'
                  : order.status === OrderStatus.AWAITING_CONFIRMATION
                    ? 'schedule'
                    : 'local_shipping'} className="text-[18px] text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0b1c30]">
                  {order.status === OrderStatus.PENDING_PAYMENT
                    ? 'Attribution après paiement et confirmation'
                    : order.status === OrderStatus.AWAITING_CONFIRMATION
                      ? 'Attribution après confirmation du producteur'
                      : 'Attribution du transporteur en cours'}
                </p>
                <p className="text-[11px] text-[#707970] mt-0.5">
                  {order.status === OrderStatus.PENDING_PAYMENT
                    ? 'Le chauffeur et le véhicule seront assignés dès la confirmation de la commande.'
                    : order.status === OrderStatus.AWAITING_CONFIRMATION
                      ? 'Le transporteur sera planifié une fois les récoltes validées.'
                      : 'Un chauffeur vous sera assigné pour la prise en charge de la récolte.'}
                </p>
              </div>
            </div>
          )}

          {/* Delivery Note & Slot (if available) */}
          {order.notes && (
            <div className="text-[11px] text-[#707970] pt-1 flex items-center gap-1.5">
              <Icon name="schedule" className="text-[15px] text-[#004322]" />
              <span className="truncate">{order.notes}</span>
            </div>
          )}
        </div>

        {/* ── 4. CARD: SUIVI DE COMMANDE (TIMELINE) ── */}
        <div
          data-testid="order-tracking-timeline"
          className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider block">
              SUIVI DE COMMANDE
            </span>
            {driverName && (
              <Link
                to="/orders/$id/tracking"
                params={{ id: order.id }}
                data-testid="track-order-header-link"
                className="text-xs font-bold text-[#004322] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Suivre</span>
                <Icon name="arrow_forward" className="text-[15px]" />
              </Link>
            )}
          </div>

          <div className="space-y-0 relative pl-1">
            {/* Step 1: Commande passée */}
            <div className="flex items-start gap-3 relative pb-5">
              {/* Vertical line connector */}
              <div className="absolute left-2.5 top-5 bottom-0 w-[2px] bg-[#004322]" />
              <div className="w-5 h-5 rounded-full bg-[#004322] text-white flex items-center justify-center shrink-0 z-10 shadow-xs">
                <Icon name="check" className="text-[14px]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Commande passée</p>
                <p className="text-[11px] text-[#707970]">
                  {formatDateTimeline(order.createdAt)}
                </p>
              </div>
            </div>

            {/* Step 2: Paiement */}
            <div className="flex items-start gap-3 relative pb-5">
              <div
                className={`absolute left-2.5 top-5 bottom-0 w-[2px] ${
                  isPaid ? 'bg-[#004322]' : 'bg-[#e2e8f0]'
                }`}
              />
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-xs ${
                  isPaid
                    ? 'bg-[#004322] text-white'
                    : isPaymentFailed
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                <Icon name={isPaid ? 'check' : isPaymentFailed ? 'close' : 'schedule'} className="text-[14px]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">
                  {isPaid
                    ? 'Paiement confirmé'
                    : isPaymentFailed
                      ? 'Paiement échoué'
                      : 'Paiement en cours de traitement'}
                </p>
                <p className="text-[11px] text-[#707970]">
                  {isPaid
                    ? formatDateTimeline(order.updatedAt || order.createdAt)
                    : isPaymentFailed
                      ? 'La transaction a échoué ou a été annulée'
                      : 'En cours de traitement par le prestataire'}
                </p>
              </div>
            </div>

            {/* Step 3: Préparation en cours */}
            <div className="flex items-start gap-3 relative pb-5">
              <div
                className={`absolute left-2.5 top-5 bottom-0 w-[2px] ${
                  isShipped ? 'bg-[#004322]' : 'bg-[#e2e8f0]'
                }`}
              />
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-xs ${
                  isShipped
                    ? 'bg-[#004322] text-white'
                    : isPreparing
                      ? 'bg-[#004322] text-white'
                      : 'bg-white border-2 border-[#c0c9be]'
                }`}
              >
                {isShipped ? (
                  <Icon name="check" className="text-[14px]" />
                ) : isPreparing ? (
                  <div className="w-2 h-2 bg-white rounded-full" />
                ) : null}
              </div>
              <div>
                <p
                  className={`text-xs font-bold ${
                    isPreparing || isShipped ? 'text-[#0b1c30]' : 'text-[#707970]'
                  }`}
                >
                  Préparation en cours
                </p>
                <p className="text-[11px] text-[#707970]">
                  {isShipped
                    ? 'Récoltes vérifiées et prêtes'
                    : isPreparing
                      ? 'Le producteur prépare vos récoltes...'
                      : 'À venir'}
                </p>
              </div>
            </div>

            {/* Step 4: Expédition */}
            <div className="flex items-start gap-3 relative">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 shadow-xs ${
                  isDelivered
                    ? 'bg-[#004322] text-white'
                    : isShipped
                      ? 'bg-[#004322] text-white'
                      : 'bg-white border-2 border-[#c0c9be]'
                }`}
              >
                {isDelivered ? (
                  <Icon name="check" className="text-[14px]" />
                ) : isShipped ? (
                  <div className="w-2 h-2 bg-white rounded-full" />
                ) : null}
              </div>
              <div>
                <p
                  className={`text-xs font-bold ${
                    isShipped || isDelivered ? 'text-[#0b1c30]' : 'text-[#707970]'
                  }`}
                >
                  Expédition
                </p>
                <p className="text-[11px] text-[#707970]">
                  {isDelivered
                    ? 'Livré'
                    : isShipped
                      ? 'En transit'
                      : 'À venir'}
                </p>
              </div>
            </div>
          </div>

          {/* Tracking button after driver assignment */}
          {driverName && (
            <div className="pt-2 border-t border-[#e2e8f0]">
              <Link
                to="/orders/$id/tracking"
                params={{ id: order.id }}
                data-testid="track-order-btn"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-xs transition-all active:scale-[0.99] shadow-xs cursor-pointer"
              >
                <Icon name="local_shipping" className="text-[18px]" />
                <span>Suivre la livraison en direct</span>
                <Icon name="arrow_forward" className="text-[16px]" />
              </Link>
            </div>
          )}
        </div>

        {/* ── 5. CARD: DOCUMENTS ── */}
        <div
          data-testid="order-documents-card"
          className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-2.5"
        >
          <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider block">
            DOCUMENTS
          </span>

          {/* Bon de commande PDF (Generated on backend) */}
          <button
            type="button"
            onClick={() => handleDownloadPdf(order.id)}
            disabled={isDownloadingPdf}
            className="w-full border border-[#c0c9be] rounded-xl p-3 flex items-center justify-between hover:bg-[#f8f9fc] active:scale-[0.99] transition-all cursor-pointer text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5 text-[#0b1c30]">
              <Icon name="description" className="text-[20px] text-[#404941]" />
              <span className="text-xs font-bold">Bon de commande PDF</span>
            </div>
            {isDownloadingPdf ? (
              <div className="w-4 h-4 border-2 border-[#004322] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="download" className="text-[18px] text-[#404941]" />
            )}
          </button>
        </div>

        {/* ── ACTIONS (Payment Retry / Processing Notice / Cancel) ── */}
        {order.status === OrderStatus.PENDING_PAYMENT && (
          <div className="pt-2 space-y-3">
            {isPaymentFailed ? (
              <>
                <div
                  data-testid="payment-failed-alert"
                  className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3"
                >
                  <Icon name="error" className="text-rose-600 text-[22px] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-900">
                      Échec du paiement
                    </p>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      Le règlement de votre commande n&apos;a pas pu aboutir. Vous pouvez relancer le paiement sécurisé pour finaliser votre commande.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => retryPayment.mutate()}
                  disabled={retryPayment.isPending}
                  className="w-full py-3.5 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {retryPayment.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Préparation du paiement...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="replay" className="text-[18px]" />
                      <span>Réessayer le paiement</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div
                data-testid="payment-processing-notice"
                className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3"
              >
                <Icon name="info" className="text-amber-700 text-[20px] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-amber-900">
                    Paiement en cours de traitement
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Le règlement est en cours de validation par le prestataire de paiement. Votre commande sera automatiquement transmise aux producteurs dès confirmation.
                  </p>
                </div>
              </div>
            )}

            {!showCancelConfirm ? (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="w-full py-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Annuler la commande
              </button>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                <p className="text-xs text-rose-800 font-semibold text-center">
                  Êtes-vous sûr de vouloir annuler cette commande ?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 py-2 bg-white border border-[#e2e8f0] rounded-lg text-xs font-bold text-gray-700 cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelOrder.mutate()}
                    disabled={cancelOrder.isPending}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    {cancelOrder.isPending ? 'Annulation...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Outlet />
    </div>
  );
}
