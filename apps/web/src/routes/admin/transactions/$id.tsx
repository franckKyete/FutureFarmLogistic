import { Icon } from '@/features/shared/components/Icon';
import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, OrderStatus, PaymentStatus, type FarmerProfileDto, type OrderPartySummaryDto } from '@futurefarm/types';
import { getOrderDetailsQuery } from '@/features/orders/api/buyer-orders.queries';
import { apiClient } from '@/lib/api-client';
import { formatPriceDirect } from '@/features/currency/store/currency.store';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/admin/transactions/$id')({
  beforeLoad: () => {
    requireAuth(Permission.ORDER_READ_ALL);
  },
  component: AdminTransactionDetailPage,
});

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  [OrderStatus.PENDING_PAYMENT]: {
    label: 'Paiement en attente',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: 'schedule',
  },
  [OrderStatus.AWAITING_CONFIRMATION]: {
    label: 'Payée • En préparation',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: 'inventory_2',
  },
  [OrderStatus.CONFIRMED]: {
    label: 'Confirmée',
    bg: 'bg-[#e6f4ea]',
    text: 'text-[#004322]',
    border: 'border-emerald-200',
    icon: 'check_circle',
  },
  [OrderStatus.SHIPPED]: {
    label: 'En transit',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: 'local_shipping',
  },
  [OrderStatus.DELIVERED]: {
    label: 'Livrée',
    bg: 'bg-[#e6f4ea]',
    text: 'text-[#004322]',
    border: 'border-emerald-200',
    icon: 'verified',
  },
  [OrderStatus.CANCELLED]: {
    label: 'Annulée',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    icon: 'cancel',
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  VEGETABLES: 'MARAÎCHAGE',
  FRUITS: 'FRUITS',
  CEREALS: 'CÉRÉALES',
  TUBERS: 'TUBERCULES',
  LEGUMES: 'LÉGUMINEUSES',
  OTHER: 'AUTRE',
};

const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return (name.slice(0, 2) || 'FF').toUpperCase();
}

function AdminTransactionDetailPage() {
  const { id } = Route.useParams();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const { data: order, isLoading, isError } = useQuery(getOrderDetailsQuery(id));

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      const response = await apiClient.get<Blob>(`/orders/${id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bon-de-commande-ORD-${id.slice(0, 8).toUpperCase()}.pdf`;
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

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
          Chargement des détails de la transaction...
        </p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white border border-[var(--admin-outline-variant)] rounded-2xl p-8 text-center space-y-3">
          <Icon name="error" className="text-4xl text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Transaction introuvable</h2>
          <p className="text-xs text-gray-500">
            La transaction demandée #{id.slice(0, 8)} n'existe pas ou a été supprimée.
          </p>
          <Link
            to="/admin/transactions"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--admin-primary)] text-white text-xs font-bold rounded-xl shadow-xs"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            <span>Retour aux transactions</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[order.status] ?? {
    label: order.status,
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
    icon: 'info',
  };

  const cropsSubtotal = (order.lines || []).reduce(
    (sum, l) => sum + Number(l.totalPrice || 0),
    0,
  );

  // Group unique farmers from order lines
  const uniqueFarmersMap = new Map<
    string,
    FarmerProfileDto & { user?: OrderPartySummaryDto }
  >();
  (order.lines || []).forEach((line) => {
    const farmer = (line.farmerProfile || line.harvest?.farmerProfile) as
      | (FarmerProfileDto & { user?: OrderPartySummaryDto })
      | undefined;
    if (farmer && farmer.id && !uniqueFarmersMap.has(farmer.id)) {
      uniqueFarmersMap.set(farmer.id, farmer);
    }
  });
  const farmersList = Array.from(uniqueFarmersMap.values());

  const buyerName = order.buyer
    ? `${order.buyer.firstName} ${order.buyer.lastName}`.trim()
    : 'Client FutureFarm';

  const deliveryMode = (order as any).delivery?.mode || 'Transporteur propre';
  const driverName = (order as any).delivery?.driverName;
  const driverPhone = (order as any).delivery?.driverPhone;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--admin-outline-variant)]/40 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/admin/transactions"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors inline-flex items-center"
              title="Retour aux transactions"
            >
              <Icon name="arrow_back" className="text-[20px]" />
            </Link>
            <h1 className="text-2xl font-black text-[var(--admin-on-surface)] tracking-tight font-mono">
              #ORD-{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
            >
              <Icon name={statusInfo.icon} className="text-[15px]" />
              <span>{statusInfo.label}</span>
            </span>
          </div>
          <p className="text-xs text-[var(--admin-on-surface-variant)] pl-9">
            Créée le {formatDate(order.createdAt)} • ID Système :{' '}
            <span className="font-mono">{order.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--admin-outline-variant)] hover:bg-gray-50 text-[var(--admin-on-surface)] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isDownloadingPdf ? (
              <div className="w-4 h-4 border-2 border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="download" className="text-[18px]" />
            )}
            <span>Télécharger Bon de Commande (PDF)</span>
          </button>
        </div>
      </div>

      {/* ── 2-COLUMN GRID LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT / MAIN COLUMN (2 cols) ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Produits & Récoltes commandés */}
          <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-[var(--admin-surface-container-low)] border-b border-[var(--admin-outline-variant)]/40 flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--admin-on-surface)] uppercase tracking-wider flex items-center gap-2">
                <Icon name="inventory_2" className="text-[18px] text-[var(--admin-primary)]" />
                <span>Récoltes & Produits Commandés ({order.lines.length})</span>
              </span>
              <span className="text-xs font-bold text-[var(--admin-primary)]">
                Sous-total : {formatPriceDirect(cropsSubtotal, order.currency)}
              </span>
            </div>

            <div className="divide-y divide-[var(--admin-outline-variant)]/30">
              {order.lines.map((line, idx) => {
                const harvest = line.harvest;
                const product = harvest?.product;
                const farmer = (line.farmerProfile ?? harvest?.farmerProfile) as
                  | (FarmerProfileDto & { user?: OrderPartySummaryDto })
                  | undefined;
                const farmerUser = farmer?.user;
                const farmerName =
                  farmer?.companyName ||
                  (farmerUser ? `${farmerUser.firstName} ${farmerUser.lastName}`.trim() : '') ||
                  'Producteur';
                const photoUrl =
                  harvest?.photoUrls && harvest.photoUrls.length > 0
                    ? harvest.photoUrls[0]
                    : DEFAULT_PRODUCT_IMAGE;

                return (
                  <div key={line.id || idx} className="p-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                    <img
                      src={photoUrl}
                      alt={product?.name ?? 'Récolte'}
                      className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                          {CATEGORY_LABEL[product?.category ?? ''] ?? product?.category ?? 'MARAÎCHAGE'}
                        </span>
                        <h3 className="font-bold text-sm text-[var(--admin-on-surface)] truncate">
                          {product?.name ?? 'Récolte'}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--admin-on-surface-variant)]">
                        <span className="flex items-center gap-1">
                          <Icon name="person" className="text-[14px]" />
                          <span>Vendeur : <strong>{farmerName}</strong></span>
                        </span>
                        <span>
                          Quantité : <strong>{line.quantity} {(harvest?.unit ?? 'kg').toLowerCase()}</strong>
                        </span>
                        <span>
                          Prix unit. : <strong>{formatPriceDirect(line.unitPrice, line.currency || order.currency)}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-[var(--admin-primary)]">
                        {formatPriceDirect(line.totalPrice, line.currency || order.currency)}
                      </div>
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {line.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Vendeurs / Producteurs associés */}
          <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs space-y-4">
            <span className="text-xs font-bold text-[var(--admin-on-surface)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="agriculture" className="text-[18px] text-emerald-700" />
              <span>Producteurs & Vendeurs impliqués ({farmersList.length})</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {farmersList.map((farmer) => {
                const user = farmer.user;
                const name =
                  farmer.companyName ||
                  (user ? `${user.firstName} ${user.lastName}`.trim() : '') ||
                  'Producteur';
                const initials = getInitials(name);

                return (
                  <div
                    key={farmer.id}
                    className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1b4d2e] text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1 text-xs space-y-0.5">
                      <div className="font-bold text-gray-900 truncate flex items-center gap-1.5">
                        <span>{name}</span>
                        {farmer.isCertified && (
                          <Icon name="verified" className="text-[#004322] text-[15px]" title="Producteur certifié" />
                        )}
                      </div>
                      {user?.email && <div className="text-gray-500 truncate">Email : {user.email}</div>}
                      {user?.phoneNumber && <div className="text-gray-500">Tél : {user.phoneNumber}</div>}
                      {farmer.address && <div className="text-gray-500 truncate">Zone : {farmer.address}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Expédition & Logistique */}
          <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-xs font-bold text-[var(--admin-on-surface)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="local_shipping" className="text-[18px] text-amber-700" />
              <span>Logistique & Livraison</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Mode de transport</span>
                <p className="font-bold text-gray-900">{deliveryMode}</p>
                <p className="text-gray-500">
                  {driverName ? `Chauffeur : ${driverName} (${driverPhone || ''})` : 'Chauffeur non assigné'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Adresse de livraison</span>
                <p className="font-bold text-gray-900">
                  {order.deliveryAddress?.street || 'Adresse principale'}
                </p>
                <p className="text-gray-500">
                  {order.deliveryAddress?.city}, {order.deliveryAddress?.country}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT / SIDEBAR COLUMN (1 col) ── */}
        <div className="space-y-6">
          {/* Card: Client / Acheteur */}
          <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-xs font-bold text-[var(--admin-on-surface)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="person" className="text-[18px] text-blue-600" />
              <span>Client / Acheteur</span>
            </span>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm shrink-0">
                {getInitials(buyerName)}
              </div>
              <div className="min-w-0 text-xs">
                <p className="font-bold text-sm text-gray-900 truncate">{buyerName}</p>
                <p className="text-gray-500 truncate">{order.buyer?.email || 'Email indisponible'}</p>
                {order.buyer?.phoneNumber && (
                  <p className="text-gray-500">Tél : {order.buyer.phoneNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Card: Décomposition Financière & Frais */}
          <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-[var(--admin-on-surface)] uppercase tracking-wider flex items-center gap-2">
                <Icon name="payments" className="text-[18px] text-[var(--admin-primary)]" />
                <span>Règlement & Frais</span>
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                {order.currency || 'CDF'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>Sous-total récoltes :</span>
                <span className="font-bold text-gray-900">
                  {formatPriceDirect(cropsSubtotal, order.currency)}
                </span>
              </div>

              {/* Itemized additional fees */}
              {order.fees && order.fees.length > 0 ? (
                order.fees.map((fee, idx) => (
                  <div key={idx} className="flex items-center justify-between text-gray-600">
                    <span className="flex items-center gap-1">
                      <Icon name={fee.code.includes('DELIVERY') ? 'local_shipping' : 'receipt'} className="text-[14px] text-gray-400" />
                      <span>{fee.name} :</span>
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatPriceDirect(fee.amount, order.currency)}
                    </span>
                  </div>
                ))
              ) : null}

              {order.cancellationFee && order.cancellationFee > 0 ? (
                <div className="flex items-center justify-between text-rose-700">
                  <span>Frais d'annulation :</span>
                  <span className="font-bold">{formatPriceDirect(order.cancellationFee, order.currency)}</span>
                </div>
              ) : null}

              <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="font-extrabold text-gray-900">Total Commande TTC :</span>
                <span className="text-base font-black text-[var(--admin-primary)]">
                  {formatPriceDirect(order.totalAmount, order.currency)}
                </span>
              </div>

              {order.currency && order.currency !== 'USD' && (
                <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 font-mono space-y-0.5">
                  <div>Taux snapshot : 1 USD = {Number(order.exchangeRate || 1).toLocaleString('fr-FR')} {order.currency}</div>
                  <div>Équivalent base : ${Number(order.totalAmountUSD || 0).toFixed(2)} USD</div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Statut Paiement */}
          <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs space-y-3">
            <span className="text-xs font-bold text-[var(--admin-on-surface)] uppercase tracking-wider flex items-center gap-2">
              <Icon name="account_balance_wallet" className="text-[18px] text-purple-600" />
              <span>Passerelle & Paiement</span>
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Statut paiement :</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                    order.paymentStatus === PaymentStatus.PAID
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.paymentStatus === PaymentStatus.FAILED
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {order.paymentStatus}
                </span>
              </div>

              {order.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Notes de commande</span>
                  <p className="text-gray-600 italic mt-0.5">{order.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
