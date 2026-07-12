import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import { useAnalytics } from '@/features/admin/api/dashboard.queries';

export const Route = createFileRoute('/admin/analytics')({
  beforeLoad: () => {
    requireAuth(Permission.DASHBOARD_READ);
  },
  component: AnalyticsPage,
});

interface RevenueEntry {
  month: string;
  revenue: number;
}

interface TopProduct {
  id: string;
  name: string;
  count: number;
}

interface AnalyticsData {
  revenueByMonth: RevenueEntry[];
  ordersByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
  topProducts: TopProduct[];
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-brand-600 text-xl">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function formatAmount(amount: number): string {
  return Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function formatNumber(n: number): string {
  return Intl.NumberFormat('fr-FR').format(n);
}

function AnalyticsPage() {
  const { data: rawData, isLoading, isError } = useAnalytics();

  if (isLoading) {
    return <div className="text-gray-400 p-6">Chargement...</div>;
  }

  if (isError) {
    return <div className="text-red-500 p-6">Erreur lors du chargement des analytiques.</div>;
  }

  if (!rawData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center text-gray-400 text-sm">
        Aucune donnée analytique disponible.
      </div>
    );
  }

  const analytics = rawData as unknown as AnalyticsData;

  const { revenueByMonth = [], ordersByStatus = {}, usersByRole = {}, topProducts = [] } = analytics;

  const hasRevenueData = revenueByMonth.length > 0;
  const hasOrdersData = Object.keys(ordersByStatus).length > 0;
  const hasUsersData = Object.keys(usersByRole).length > 0;
  const hasProductsData = topProducts.length > 0;

  const maxRevenue = hasRevenueData
    ? Math.max(...revenueByMonth.map((r) => r.revenue), 1)
    : 1;

  const totalOrders = Object.values(ordersByStatus).reduce((sum, c) => sum + c, 0);
  const totalUsers = Object.values(usersByRole).reduce((sum, c) => sum + c, 0);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="material-symbols-outlined text-brand-600 text-3xl">bar_chart</span>
          <h1 className="text-2xl font-bold text-gray-900">Analytiques & rapports</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 ml-11">
          Visualisez les tendances, les revenus et les performances de la plateforme.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="trending_up"
          title="Revenu total"
          value={hasRevenueData ? formatAmount(revenueByMonth.reduce((s, r) => s + r.revenue, 0)) : '—'}
          subtitle="Sur la période"
        />
        <StatCard
          icon="receipt_long"
          title="Commandes"
          value={hasOrdersData ? formatNumber(totalOrders) : '—'}
          subtitle="Tous statuts confondus"
        />
        <StatCard
          icon="people"
          title="Utilisateurs"
          value={hasUsersData ? formatNumber(totalUsers) : '—'}
          subtitle="Tous rôles confondus"
        />
        <StatCard
          icon="inventory_2"
          title="Produits vendus"
          value={hasProductsData ? formatNumber(topProducts.length) : '—'}
          subtitle="Produits les plus vendus"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-brand-600">bar_chart</span>
            <h2 className="text-lg font-semibold text-gray-900">Revenus par mois</h2>
          </div>
          {hasRevenueData ? (
            <div className="flex items-end gap-2 h-52">
              {revenueByMonth.map((item, idx) => {
                const pct = (item.revenue / maxRevenue) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-semibold text-gray-600 leading-tight text-center">
                      {Intl.NumberFormat('fr-FR').format(item.revenue)} FCFA
                    </span>
                    <div
                      className="w-full bg-brand-500 rounded-t-md transition-all hover:bg-brand-600 min-h-[4px]"
                      style={{ height: `${pct}%` }}
                    />
                    <span className="text-[11px] text-gray-500 font-medium">{item.month}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Aucune donnée de revenu disponible.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-brand-600">pie_chart</span>
            <h2 className="text-lg font-semibold text-gray-900">Commandes par statut</h2>
          </div>
          {hasOrdersData ? (
            <div className="space-y-2">
              {Object.entries(ordersByStatus).map(([status, count]) => {
                const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-28 text-sm font-medium text-gray-700 capitalize truncate">
                      {status}
                    </span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-bold text-gray-900">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Aucune commande trouvée.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-brand-600">group</span>
            <h2 className="text-lg font-semibold text-gray-900">Utilisateurs par rôle</h2>
          </div>
          {hasUsersData ? (
            <div className="space-y-2">
              {Object.entries(usersByRole).map(([role, count]) => {
                const pct = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
                return (
                  <div key={role} className="flex items-center gap-3">
                    <span className="w-28 text-sm font-medium text-gray-700 capitalize truncate">
                      {role}
                    </span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-bold text-gray-900">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Aucun utilisateur trouvé.</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-brand-600">category</span>
            <h2 className="text-lg font-semibold text-gray-900">Produits les plus vendus</h2>
          </div>
          {hasProductsData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                      Ventes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="py-3 text-sm font-semibold text-gray-900 text-right">
                        {Intl.NumberFormat('fr-FR').format(product.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-12 text-center">Aucun produit trouvé.</p>
          )}
        </section>
      </div>
    </div>
  );
}
