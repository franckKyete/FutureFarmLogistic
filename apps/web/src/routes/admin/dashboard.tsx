import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import { useDashboardStats } from '@/features/admin/api/dashboard.queries';

export const Route = createFileRoute('/admin/dashboard')({
  beforeLoad: () => {
    requireAuth(Permission.DASHBOARD_READ);
  },
  component: DashboardPage,
});

interface RecentOrder {
  id: string;
  clientName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  REJECTED: 'Rejetée',
  SHIPPED: 'En transit',
  DELIVERED: 'Livrée',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
};

function DashboardPage() {
  const { data: stats, isLoading, isError, refetch } = useDashboardStats();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!stats) return <EmptyState />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-gray-500">Vue d'ensemble de la plateforme</p>
      </div>

      <StatsGrid stats={stats} />
      <RecentOrdersSection orders={stats.recentOrders as RecentOrder[]} />
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded mt-2 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
            <div className="h-8 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-28 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="h-6 w-36 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="h-4 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-4 w-28 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <span className="material-symbols-outlined text-5xl text-red-400 mb-4">
        error_outline
      </span>
      <p className="text-gray-600 text-lg font-medium mb-1">
        Erreur de chargement
      </p>
      <p className="text-gray-400 text-sm mb-6">
        Impossible de récupérer les données du tableau de bord
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors active:scale-95"
      >
        Réessayer
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">
        dashboard
      </span>
      <p className="text-gray-500 text-lg font-medium mb-1">
        Aucune donnée disponible
      </p>
      <p className="text-gray-400 text-sm">
        Les statistiques du tableau de bord apparaîtront ici une fois disponibles.
      </p>
    </div>
  );
}

function StatsGrid({ stats }: { stats: { totalUsers: number; pendingValidations: number; activeAuctions: number; activeRuns: number; pendingInspections: number; openDisputes: number; monthlyRevenue: number } }) {
  const cards = [
    {
      label: 'Utilisateurs totaux',
      value: stats.totalUsers.toLocaleString('fr-FR'),
      icon: 'people',
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Validations en attente',
      value: stats.pendingValidations.toLocaleString('fr-FR'),
      icon: 'pending_actions',
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Enchères actives',
      value: stats.activeAuctions.toLocaleString('fr-FR'),
      icon: 'gavel',
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Tournées actives',
      value: stats.activeRuns.toLocaleString('fr-FR'),
      icon: 'local_shipping',
      iconColor: 'text-teal-500',
      bgColor: 'bg-teal-50',
    },
    {
      label: 'Inspections en cours',
      value: stats.pendingInspections.toLocaleString('fr-FR'),
      icon: 'verified',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Litiges ouverts',
      value: stats.openDisputes.toLocaleString('fr-FR'),
      icon: 'scale',
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Revenus du mois',
      value: new Intl.NumberFormat('fr-FR').format(stats.monthlyRevenue) + ' FCFA',
      icon: 'payments',
      iconColor: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
        >
          <div
            className={`w-10 h-10 ${card.bgColor} rounded-lg flex items-center justify-center mb-3`}
          >
            <span className={`material-symbols-outlined text-2xl ${card.iconColor}`}>
              {card.icon}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

function RecentOrdersSection({ orders }: { orders: RecentOrder[] }) {
  const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (orders.length === 0) {
    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Commandes récentes</h2>
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-100 shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
            receipt_long
          </span>
          <p className="text-gray-500 text-sm">
            Aucune commande récente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Commandes récentes</h2>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                ID
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                Client
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                Montant
              </th>
              <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                Statut
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-gray-600">
                  #{order.id.slice(0, 8)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {order.clientName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                  {new Intl.NumberFormat('fr-FR').format(order.totalAmount)} FCFA
                </td>
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 text-right">
                  {dateFormatter.format(new Date(order.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
