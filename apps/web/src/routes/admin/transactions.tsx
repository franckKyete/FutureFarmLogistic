import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, OrderStatus, type OrderDto } from '@futurefarm/types';
import { useAllOrders } from '@/features/admin/api/orders.queries';
import { StatCard, Badge } from '@/features/admin/components';

interface OrderApiResponse extends OrderDto {
  buyer?: { firstName: string; lastName: string } | null;
  farmer?: { firstName: string; lastName: string } | null;
  product?: { name: string } | null;
}

export const Route = createFileRoute('/admin/transactions')({
  beforeLoad: () => {
    requireAuth(Permission.ORDER_READ_ALL);
  },
  component: TransactionsPage,
});

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: OrderStatus.PENDING_PAYMENT, label: 'En attente' },
  { value: OrderStatus.AWAITING_CONFIRMATION, label: 'En attente' },
  { value: OrderStatus.CONFIRMED, label: 'Confirmée' },
  { value: OrderStatus.SHIPPED, label: 'En transit' },
  { value: OrderStatus.DELIVERED, label: 'Livrée' },
  { value: OrderStatus.CANCELLED, label: 'Annulée' },
];

const STATUS_LABELS: Record<string, string> = {
  [OrderStatus.PENDING_PAYMENT]: 'En attente',
  [OrderStatus.AWAITING_CONFIRMATION]: 'En attente',
  [OrderStatus.CONFIRMED]: 'Confirmée',
  [OrderStatus.SHIPPED]: 'En transit',
  [OrderStatus.DELIVERED]: 'Livrée',
  [OrderStatus.CANCELLED]: 'Annulée',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  [OrderStatus.PENDING_PAYMENT]: 'warning',
  [OrderStatus.AWAITING_CONFIRMATION]: 'warning',
  [OrderStatus.CONFIRMED]: 'info',
  [OrderStatus.SHIPPED]: 'info',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'error',
};

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

function truncateId(id: string): string {
  if (!id) return '—';
  return id.slice(0, 8) + '...';
}

function TransactionsPage() {
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
    const enAttente = list.filter(
      (o) =>
        o.status === OrderStatus.PENDING_PAYMENT ||
        o.status === OrderStatus.AWAITING_CONFIRMATION,
    ).length;
    const completed = list.filter(
      (o) => o.status === OrderStatus.DELIVERED,
    ).length;
    return { totalVolume, todayCount, enAttente, completed };
  }, [orders]);

  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));

  const inputClasses =
    'rounded-lg border border-[var(--admin-outline-variant)] px-3 py-2 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20 outline-none transition-colors bg-[var(--admin-surface-container-lowest)]';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-[var(--admin-on-surface-variant)]">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            />
          </svg>
          <span className="text-sm">Chargement des transactions...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[var(--admin-error-container)] bg-[var(--admin-error-container)]/50 p-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[var(--admin-error)] text-2xl">error</span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--admin-error)]">
              Erreur de chargement
            </h3>
            <p className="text-sm text-[var(--admin-error)] mt-1 opacity-80">
              Impossible de charger la liste des transactions. Veuillez réessayer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">
          Gestion des transactions
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          Historique des transactions et commandes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="payments"
          value={formatAmount(stats.totalVolume)}
          label="Volume total"
        />
        <StatCard
          icon="today"
          value={String(stats.todayCount)}
          label="Transactions aujourd'hui"
        />
        <StatCard
          icon="pending_actions"
          value={String(stats.enAttente)}
          label="En attente"
        />
        <StatCard
          icon="check_circle"
          value={String(stats.completed)}
          label="Complétées"
        />
      </div>

      <div className="bg-[var(--admin-surface-container-lowest)] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--admin-on-surface-variant)] mb-1.5">
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
            <label className="block text-xs font-medium text-[var(--admin-on-surface-variant)] mb-1.5">
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
            <label className="block text-xs font-medium text-[var(--admin-on-surface-variant)] mb-1.5">
              Au
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {orderList.length === 0 ? (
        <div className="rounded-xl border border-[var(--admin-outline-variant)] bg-[var(--admin-surface-container-lowest)] p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--admin-on-surface-variant)] mb-3">
            receipt_long
          </span>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Aucune transaction trouvée.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-[var(--admin-surface-container-lowest)]">
          <table className="min-w-full divide-y divide-[var(--admin-outline-variant)]">
            <thead className="bg-[var(--admin-surface-container)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  ID transaction
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Acheteur
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Vendeur
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Produit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Montant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-outline-variant)]">
              {orderList.map((order) => {
                const enhanced = order as OrderApiResponse;
                const buyerName =
                  enhanced.buyer?.firstName || enhanced.buyer?.lastName
                    ? `${enhanced.buyer?.firstName ?? ''} ${enhanced.buyer?.lastName ?? ''}`.trim()
                    : '—';
                const farmerName =
                  enhanced.farmer?.firstName || enhanced.farmer?.lastName
                    ? `${enhanced.farmer?.firstName ?? ''} ${enhanced.farmer?.lastName ?? ''}`.trim()
                    : '—';
                const productName = enhanced.product?.name ?? '—';
                return (
                <tr
                  key={order.id}
                  className="hover:bg-[var(--admin-surface-container)]/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-mono text-[var(--admin-on-surface-variant)]">
                    {truncateId(order.id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                    {buyerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                    {farmerName}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-on-surface)]">
                    {productName}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-[var(--admin-on-surface)] whitespace-nowrap">
                    {formatAmount(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[order.status] ?? 'info'}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)] whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center p-2 rounded-lg text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container)] hover:text-[var(--admin-on-surface)] transition-colors"
                      title="Voir les détails"
                    >
                      <span className="material-symbols-outlined text-xl">visibility</span>
                    </button>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-[var(--admin-on-surface-variant)]">
        <span>
          Affichage de 1-{Math.min(PAGE_SIZE, totalOrders)} sur {totalOrders}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--admin-outline-variant)] text-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
            Précédent
          </button>
          <span className="px-2 text-xs">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--admin-outline-variant)] text-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-container)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Suivant
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
