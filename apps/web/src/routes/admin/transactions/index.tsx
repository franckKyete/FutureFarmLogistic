import { useState, useMemo } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, OrderStatus } from '@futurefarm/types';
import { useAllOrders } from '@/features/admin/api/orders.queries';
import { StatCard } from '@/features/admin/components';
import { formatPriceDirect } from '@/features/currency/store/currency.store';

export const Route = createFileRoute('/admin/transactions/')({
  beforeLoad: () => {
    requireAuth(Permission.ORDER_READ_ALL);
  },
  component: TransactionsPage,
});

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: OrderStatus.PENDING_PAYMENT, label: 'Paiement en attente' },
  { value: OrderStatus.AWAITING_CONFIRMATION, label: 'Payée • En préparation' },
  { value: OrderStatus.CONFIRMED, label: 'Confirmée' },
  { value: OrderStatus.SHIPPED, label: 'En transit' },
  { value: OrderStatus.DELIVERED, label: 'Livrée' },
  { value: OrderStatus.CANCELLED, label: 'Annulée' },
];

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

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateId(id: string): string {
  if (!id) return '—';
  return id.slice(0, 8).toUpperCase();
}

function TransactionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: orders, isLoading, isError } = useAllOrders(page, PAGE_SIZE);

  const orderList = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    return list.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (dateFrom && new Date(order.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(order.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [orders, statusFilter, dateFrom, dateTo]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const list = Array.isArray(orders) ? orders : [];
    const totalVolume = list.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const todayCount = list.filter(
      (o) => new Date(o.createdAt) >= todayStart,
    ).length;
    const pendingPayment = list.filter(
      (o) => o.status === OrderStatus.PENDING_PAYMENT,
    ).length;
    const preparingCount = list.filter(
      (o) =>
        o.status === OrderStatus.AWAITING_CONFIRMATION ||
        o.status === OrderStatus.CONFIRMED,
    ).length;
    const completed = list.filter(
      (o) => o.status === OrderStatus.DELIVERED,
    ).length;
    return { totalVolume, todayCount, pendingPayment, preparingCount, completed };
  }, [orders]);

  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));

  const inputClasses =
    'rounded-xl border border-[var(--admin-outline-variant)] px-3 py-2 text-xs font-medium text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20 outline-none transition-colors bg-[var(--admin-surface-container-lowest)]';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="flex items-center gap-3 text-[var(--admin-on-surface-variant)]">
          <div className="w-5 h-5 border-2 border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Chargement des transactions...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[var(--admin-error-container)] bg-[var(--admin-error-container)]/50 p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[var(--admin-error)] text-2xl">error</span>
          <div>
            <h3 className="text-sm font-bold text-[var(--admin-error)]">
              Erreur de chargement
            </h3>
            <p className="text-xs text-[var(--admin-error)] mt-1 opacity-80">
              Impossible de charger la liste des transactions. Veuillez réessayer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="border-b border-[var(--admin-outline-variant)]/40 pb-5">
        <h1 className="text-2xl font-black text-[var(--admin-on-surface)] tracking-tight flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[28px] text-[var(--admin-primary)]">
            receipt_long
          </span>
          <span>Gestion des transactions & commandes</span>
        </h1>
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
          Consultez l'historique complet, les règlements financiers, et cliquez sur une ligne pour voir le détail complet.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="payments"
          value={formatPriceDirect(stats.totalVolume, 'CDF')}
          label="Volume total"
        />
        <StatCard
          icon="today"
          value={String(stats.todayCount)}
          label="Transactions aujourd'hui"
        />
        <StatCard
          icon="schedule"
          value={String(stats.pendingPayment)}
          label="Paiement en attente"
        />
        <StatCard
          icon="inventory_2"
          value={String(stats.preparingCount)}
          label="Payées / En préparation"
        />
      </div>

      <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[var(--admin-on-surface-variant)] mb-1 uppercase tracking-wider">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className={inputClasses}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--admin-on-surface-variant)] mb-1 uppercase tracking-wider">
              Du
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[var(--admin-on-surface-variant)] mb-1 uppercase tracking-wider">
              Au
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputClasses}
            />
          </div>
          {(statusFilter || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {orderList.length === 0 ? (
        <div className="rounded-2xl border border-[var(--admin-outline-variant)]/60 bg-[var(--admin-surface-container-lowest)] p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--admin-on-surface-variant)]/50 mb-2 block">
            receipt_long
          </span>
          <p className="text-sm font-bold text-[var(--admin-on-surface)]">Aucune transaction trouvée</p>
          <p className="text-xs text-[var(--admin-on-surface-variant)] mt-1">
            Modifiez vos filtres ou effectuez de nouvelles commandes pour afficher des données.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--admin-outline-variant)]/60 bg-[var(--admin-surface-container-lowest)] shadow-xs">
          <table className="min-w-full divide-y divide-[var(--admin-outline-variant)]/40 text-left border-collapse">
            <thead className="bg-[var(--admin-surface-container-low)]">
              <tr className="text-[11px] font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                <th className="py-3.5 px-5">Réf. Commande</th>
                <th className="py-3.5 px-4">Client / Acheteur</th>
                <th className="py-3.5 px-4">Contenu & Récoltes</th>
                <th className="py-3.5 px-4">Montant Total</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Date de création</th>
                <th className="py-3.5 px-4 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-outline-variant)]/30 text-xs">
              {orderList.map((order) => {
                const buyerName = order.buyer
                  ? `${order.buyer.firstName} ${order.buyer.lastName}`.trim()
                  : 'Client FutureFarm';
                const statusInfo = STATUS_CONFIG[order.status] ?? {
                  label: order.status,
                  bg: 'bg-gray-100',
                  text: 'text-gray-800',
                  border: 'border-gray-200',
                  icon: 'info',
                };

                const linesCount = order.lines?.length ?? 0;
                const uniqueFarmers = new Set(
                  (order.lines || []).map((l) => l.farmerProfileId).filter(Boolean),
                ).size;

                const firstLineName = order.lines?.[0]?.harvest?.product?.name;
                const itemsSummary =
                  linesCount === 0
                    ? 'Aucun article'
                    : linesCount === 1
                      ? firstLineName || '1 article'
                      : `${linesCount} articles (${firstLineName || 'Multi-produits'}...)`;

                return (
                  <tr
                    key={order.id}
                    onClick={() => {
                      void navigate({
                        to: '/admin/transactions/$id',
                        params: { id: order.id },
                      });
                    }}
                    className="hover:bg-[var(--admin-surface-container-low)]/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-5">
                      <div className="font-mono font-bold text-[var(--admin-primary)] group-hover:underline flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">receipt</span>
                        <span>#ORD-{truncateId(order.id)}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-semibold text-[var(--admin-on-surface)]">
                      <div>{buyerName}</div>
                      {order.buyer?.email && (
                        <div className="text-[10px] text-[var(--admin-on-surface-variant)] font-normal truncate max-w-[180px]">
                          {order.buyer.email}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-semibold text-[var(--admin-on-surface)]">{itemsSummary}</div>
                      <div className="text-[10px] text-[var(--admin-on-surface-variant)]">
                        {uniqueFarmers > 0
                          ? `${uniqueFarmers} producteur${uniqueFarmers > 1 ? 's' : ''}`
                          : 'Producteur standard'}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-bold text-sm text-[var(--admin-on-surface)]">
                        {formatPriceDirect(order.totalAmount, order.currency)}
                      </div>
                      {order.currency && order.currency !== 'USD' && order.totalAmountUSD && (
                        <div className="text-[10px] text-[var(--admin-on-surface-variant)] font-mono">
                          ≈ ${Number(order.totalAmountUSD).toFixed(2)} USD
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {statusInfo.icon}
                        </span>
                        <span>{statusInfo.label}</span>
                      </span>
                    </td>

                    <td className="py-4 px-4 text-[var(--admin-on-surface-variant)] font-medium">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[var(--admin-primary)] font-bold group-hover:translate-x-0.5 transition-transform">
                        <span>Voir</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-[var(--admin-on-surface-variant)] font-medium pt-2">
        <span>
          Affichage de 1-{Math.min(PAGE_SIZE, totalOrders)} sur {totalOrders} commande{totalOrders > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--admin-outline-variant)] text-xs font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-container-low)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            Précédent
          </button>
          <span className="px-2 font-bold">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--admin-outline-variant)] text-xs font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-container-low)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Suivant
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
