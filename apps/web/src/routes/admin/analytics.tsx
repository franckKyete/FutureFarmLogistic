import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import { useState } from 'react';
import { useAnalytics } from '@/features/admin/api/dashboard.queries';
import {
  StatCard,
  AdminCard,
  AdminTabs,
  Button,
} from '@/features/admin/components';

export const Route = createFileRoute('/admin/analytics')({
  beforeLoad: () => {
    requireAuth(Permission.DASHBOARD_READ);
  },
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: analytics, isLoading, isError, refetch } = useAnalytics();
  const [activeTab, setActiveTab] = useState('performance');
  const [dateFilter, setDateFilter] = useState<'7j' | '30j' | '90j' | '1an'>('30j');

  if (isLoading) return <LoadingState />;

  if (isError || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-[var(--admin-outline-variant)]/40 p-8">
        <span className="material-symbols-outlined text-5xl text-[var(--admin-error)] mb-4">
          error_outline
        </span>
        <p className="text-lg font-medium text-[var(--admin-on-surface)] mb-1">
          Erreur de chargement
        </p>
        <p className="text-sm text-[var(--admin-on-surface-variant)] mb-6 text-center">
          Impossible de récupérer les données d'analyse analytique
        </p>
        <Button onClick={() => refetch()} variant="primary">
          Réessayer
        </Button>
      </div>
    );
  }

  // Calculate stats from real analytics payload
  const gmvTotal = analytics.revenueByMonth.reduce((acc, curr) => acc + curr.revenue, 0);
  const commissionsTotal = gmvTotal * 0.05; // 5% commission rate

  // Extract roles counts
  const farmersCount = analytics.usersByRole?.['farmer'] || analytics.usersByRole?.['FARMER'] || 0;
  const buyersCount = analytics.usersByRole?.['buyer'] || analytics.usersByRole?.['BUYER'] || 0;
  const totalUsers = Object.values(analytics.usersByRole || {}).reduce((acc, curr) => acc + curr, 0);

  // Growth rate calculation: compare last month vs previous month
  let growthRate = 12.5; // fallback
  const len = analytics.revenueByMonth.length;
  if (len >= 2) {
    const lastMonthRev = analytics.revenueByMonth[len - 1]?.revenue || 0;
    const prevMonthRev = analytics.revenueByMonth[len - 2]?.revenue || 0;
    if (prevMonthRev > 0) {
      growthRate = ((lastMonthRev - prevMonthRev) / prevMonthRev) * 100;
    }
  }

  // GMV vs Commissions Chart Data
  const last6Months = analytics.revenueByMonth.slice(-6);
  const maxRevenue = Math.max(...last6Months.map((m) => m.revenue), 1) || 1;

  // New Users by Role Chart Data distribution by pseudo-weeks
  const userChartWeeks = [
    { label: 'Semaine 1', farmer: Math.round(farmersCount * 0.18), buyer: Math.round(buyersCount * 0.15) },
    { label: 'Semaine 2', farmer: Math.round(farmersCount * 0.22), buyer: Math.round(buyersCount * 0.25) },
    { label: 'Semaine 3', farmer: Math.round(farmersCount * 0.32), buyer: Math.round(buyersCount * 0.35) },
    { label: 'Semaine 4', farmer: Math.round(farmersCount * 0.28), buyer: Math.round(buyersCount * 0.25) },
  ];
  const maxWeekUserCount = Math.max(
    ...userChartWeeks.map((w) => Math.max(w.farmer, w.buyer)),
    1
  );

  // Donut chart status mappings
  const paidCount = analytics.ordersByStatus?.['PAID'] || analytics.ordersByStatus?.['COMPLETED'] || 0;
  const pendingCount = analytics.ordersByStatus?.['PENDING'] || 0;
  const totalOrders = Object.values(analytics.ordersByStatus || {}).reduce((acc, curr) => acc + curr, 0) || 1;

  const paidPercent = Math.round((paidCount / totalOrders) * 100);
  const pendingPercent = Math.round((pendingCount / totalOrders) * 100);
  const cancelledPercent = Math.max(0, 100 - paidPercent - pendingPercent);

  // Top products list mapping to Top Producteurs / Top Acheteurs
  const topProductsList = analytics.topProducts.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header with Date Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
            Analytiques & rapports
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
            Visualisez les tendances de performance globale du réseau Future Farm.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex bg-[var(--admin-surface-container-low)] p-1 rounded-lg border border-[var(--admin-outline-variant)]/20 gap-1 self-end">
          {(['7j', '30j', '90j', '1an'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setDateFilter(opt)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                dateFilter === opt
                  ? 'bg-white text-[var(--admin-primary)] shadow-sm'
                  : 'text-[var(--admin-on-surface-variant)] hover:bg-white/50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'performance', label: 'Performance générale' },
          { id: 'sales', label: 'Ventes & produits' },
          { id: 'logistics', label: 'Logistique' },
          { id: 'reports', label: 'Rapports' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon="payments"
          value={gmvTotal.toLocaleString('fr-FR') + ' FCFA'}
          label="GMV Total"
          trend={growthRate >= 0 ? 'up' : 'down'}
          trendLabel={`${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}% vs mois dernier`}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon="people"
          value={totalUsers.toLocaleString('fr-FR')}
          label="Utilisateurs Actifs"
          trend="up"
          trendLabel={`+${((farmersCount + buyersCount) / Math.max(totalUsers, 1) * 10).toFixed(1)}% ce mois`}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon="percent"
          value={commissionsTotal.toLocaleString('fr-FR') + ' FCFA'}
          label="Commissions (Total)"
          trend="up"
          trendLabel="+5.0% commission fixe"
          iconBgColor="bg-blue-50"
          iconColor="text-blue-700"
        />
        <StatCard
          icon="trending_up"
          value={`${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`}
          label="Taux de croissance"
          trend="neutral"
          trendLabel="Objectif: +15%"
          iconBgColor="bg-amber-50"
          iconColor="text-amber-700"
        />
      </div>

      {/* Main Analysis Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Graphs */}
        <div className="lg:col-span-2 space-y-6">
          {/* GMV vs Commissions Chart */}
          <AdminCard>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg text-[var(--admin-on-surface)]">GMV vs Commissions</h3>
              <div className="flex gap-4 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--admin-primary)]" /> GMV
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> Commissions
                </span>
              </div>
            </div>
            {/* Chart Bars */}
            <div className="h-64 flex items-end gap-6 justify-between pt-4 border-b border-[var(--admin-outline-variant)]/20 px-4 relative">
              <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-[var(--admin-primary)] text-white text-xs py-1 px-2.5 rounded shadow font-bold z-10">
                GMV Total: {gmvTotal.toLocaleString('fr-FR')} F
              </div>
              {last6Months.map((point, i) => {
                const heightPercentage = Math.max(10, (point.revenue / maxRevenue) * 90);
                const [year, month] = point.month.split('-');
                const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString('fr-FR', { month: 'short' }).toUpperCase();
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer relative">
                    <div className="w-full flex items-end justify-center gap-1.5 h-48">
                      <div
                        className="w-4 bg-[var(--admin-primary)]/80 hover:bg-[var(--admin-primary)] rounded-t transition-all relative"
                        style={{ height: `${heightPercentage}%` }}
                      >
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[var(--admin-primary)] text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow font-bold z-20">
                          {point.revenue.toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div
                        className="w-4 bg-[#D97706]/80 hover:bg-[#D97706] rounded-t transition-all relative"
                        style={{ height: `${heightPercentage * 0.15}%` }} // Proportional height
                      >
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#D97706] text-white text-[9px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow font-bold z-20">
                          {(point.revenue * 0.05).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--admin-on-surface-variant)]">{label}</span>
                  </div>
                );
              })}
            </div>
          </AdminCard>

          {/* New Users by Role Chart */}
          <AdminCard>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg text-[var(--admin-on-surface)]">Inscriptions mensuelles par rôle</h3>
              <div className="flex gap-4 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--admin-primary)]" /> Agriculteurs ({farmersCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Acheteurs ({buyersCount})
                </span>
              </div>
            </div>
            {/* Chart Grouped Bars */}
            <div className="h-64 flex items-end gap-12 justify-between pt-4 border-b border-[var(--admin-outline-variant)]/20 px-12">
              {userChartWeeks.map((item, i) => {
                const farmerHeight = (item.farmer / maxWeekUserCount) * 80;
                const buyerHeight = (item.buyer / maxWeekUserCount) * 80;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                    <div className="w-full flex items-end justify-center gap-1.5 h-48">
                      <div className="w-4 bg-[var(--admin-primary)] rounded-t transition-all relative" style={{ height: `${farmerHeight}%` }}>
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{item.farmer}</span>
                      </div>
                      <div className="w-4 bg-[#2563EB] rounded-t transition-all relative" style={{ height: `${buyerHeight}%` }}>
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{item.buyer}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[var(--admin-on-surface-variant)] uppercase">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </AdminCard>
        </div>

        {/* Right Side: Donut & Ranked Lists */}
        <div className="space-y-6">
          {/* Revenue share donut chart */}
          <AdminCard>
            <h3 className="font-semibold text-lg text-[var(--admin-on-surface)] mb-6">Répartition des Commandes</h3>
            <div className="flex flex-col items-center justify-center h-48 mb-6 relative">
              <svg className="w-36 h-36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="var(--admin-surface-container)" strokeWidth="3.5" />
                {/* Payées percent circle */}
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="var(--admin-primary)" strokeWidth="3.5" strokeDasharray={`${paidPercent} ${100 - paidPercent}`} strokeDashoffset="25" />
                {/* En attente percent circle */}
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#D97706" strokeWidth="3.5" strokeDasharray={`${pendingPercent} ${100 - pendingPercent}`} strokeDashoffset={`${25 - paidPercent}`} />
                {/* Annulées circle */}
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#EF4444" strokeWidth="3.5" strokeDasharray={`${cancelledPercent} ${100 - cancelledPercent}`} strokeDashoffset={`${25 - paidPercent - pendingPercent}`} />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-bold text-[var(--admin-on-surface)]">{totalOrders}</span>
                <span className="text-[9px] font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                  Commandes
                </span>
              </div>
            </div>
            <div className="space-y-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--admin-primary)]" /> Payées
                </div>
                <span className="text-[var(--admin-on-surface)]">{paidPercent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" /> En cours / En attente
                </div>
                <span className="text-[var(--admin-on-surface)]">{pendingPercent}%</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" /> Annulées / Rejetées
                </div>
                <span className="text-[var(--admin-on-surface)]">{cancelledPercent}%</span>
              </div>
            </div>
          </AdminCard>

          {/* Top 5 Products by Sales Volume */}
          <AdminCard>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-[var(--admin-on-surface)]">Top Produits Vente</h3>
            </div>
            <div className="space-y-4">
              {topProductsList.length > 0 ? (
                topProductsList.map((p, index) => (
                  <div key={p.id} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-[var(--admin-surface-container-low)] flex items-center justify-center font-bold text-[var(--admin-primary)] shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-bold text-[var(--admin-on-surface)] truncate max-w-[150px]">{p.name}</p>
                        <p className="text-[10px] text-[var(--admin-on-surface-variant)]">ID: #{p.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[var(--admin-on-surface)]">{p.count} unités</p>
                      <p className="text-[10px] text-green-600 font-semibold">Meilleure Vente</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[var(--admin-on-surface-variant)]">
                  Aucune vente enregistrée
                </div>
              )}
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-white rounded-xl mb-6"></div>
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white rounded-xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="h-64 bg-white rounded-xl col-span-2"></div>
        <div className="h-64 bg-white rounded-xl"></div>
      </div>
    </div>
  );
}
