import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, AuctionStatus, type AuctionDto } from '@futurefarm/types';
import { apiClient } from '@/lib/api-client';
import {
  StatCard,
  Button,
  AdminTable,
  AdminTabs,
  StatusBadge,
} from '@/features/admin/components';

export const Route = createFileRoute('/admin/auctions')({
  beforeLoad: () => {
    requireAuth(Permission.AUCTION_MANAGE);
  },
  component: AuctionsSupervisionPage,
});

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}

function formatRemainingTime(endAt: string): string {
  const now = new Date();
  const end = new Date(endAt);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return 'Terminée';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}j ${hours % 24}h`;
  }
  return `${hours}h ${minutes}min`;
}

function AuctionsSupervisionPage() {
  const [activeTab, setActiveTab] = useState<string>('active');

  const { data, isLoading, isError, error } = useQuery<AuctionDto[]>({
    queryKey: ['auctions', 'admin'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: AuctionDto[]; meta: unknown } }>('/auctions');
      return res.data.data.data;
    },
  });

  const auctionList = data ?? [];

  const activeStatuses = useMemo(() => {
    if (activeTab === 'active') return [AuctionStatus.ACTIVE];
    if (activeTab === 'scheduled') return [AuctionStatus.SCHEDULED];
    return [AuctionStatus.SOLD, AuctionStatus.EXPIRED, AuctionStatus.CANCELLED];
  }, [activeTab]);

  const filteredAuctions = useMemo(
    () => auctionList.filter((a) => activeStatuses.includes(a.status)),
    [auctionList, activeStatuses],
  );

  const stats = useMemo(() => {
    const activeCount = auctionList.filter((a) => a.status === AuctionStatus.ACTIVE).length;
    const pendingCount = auctionList.filter((a) => a.status === AuctionStatus.SCHEDULED).length;
    const soldCount = auctionList.filter((a) => a.status === AuctionStatus.SOLD).length;
    const totalAmount = auctionList.reduce((sum, a) => sum + a.currentPrice, 0);
    return { activeCount, pendingCount, soldCount, totalAmount };
  }, [auctionList]);

  const tableColumns = [
    {
      key: 'product',
      header: 'Produit',
      render: (auc: AuctionDto) => (
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-[var(--admin-on-surface-variant)]/60">
            inventory_2
          </span>
          <span className="font-bold text-[var(--admin-on-surface)]">Lot #{auc.harvestId?.slice(0, 8) || 'Sans lot'}</span>
        </span>
      ),
    },
    {
      key: 'currentPrice',
      header: 'Prix actuel',
      render: (auc: AuctionDto) => (
        <span className="font-semibold text-[var(--admin-primary)]">{formatPrice(auc.currentPrice)}</span>
      ),
    },
    {
      key: 'startingPrice',
      header: 'Prix de départ',
      render: (auc: AuctionDto) => <span className="font-medium text-xs">{formatPrice(auc.startingPrice)}</span>,
    },
    {
      key: 'winnerId',
      header: 'Dernier enchérisseur',
      render: (auc: AuctionDto) => (
        <span className="text-xs text-[var(--admin-on-surface-variant)]">
          {auc.winnerId ? `#${auc.winnerId.slice(0, 8)}` : '—'}
        </span>
      ),
    },
    {
      key: 'endAt',
      header: 'Temps restant',
      render: (auc: AuctionDto) => (
        <span className="flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)] font-medium">
          <span className="material-symbols-outlined text-xs">schedule</span>
          {formatRemainingTime(auc.endAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (auc: AuctionDto) => {
        const statusMap: Record<AuctionStatus, string> = {
          [AuctionStatus.ACTIVE]: 'active',
          [AuctionStatus.SCHEDULED]: 'pending',
          [AuctionStatus.SOLD]: 'delivered',
          [AuctionStatus.EXPIRED]: 'inactive',
          [AuctionStatus.CANCELLED]: 'banned',
        };
        return <StatusBadge status={statusMap[auc.status] || 'inactive'} label={auc.status} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: () => (
        <div className="flex justify-end gap-1">
          <Button variant="tertiary" size="sm" className="text-xs">
            Détails
          </Button>
          <Button variant="tertiary" size="sm" className="text-xs text-red-600">
            Suspendre
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-white rounded-xl mb-6"></div>
        <div className="grid grid-cols-4 gap-6 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-[var(--admin-outline-variant)]/40 p-8">
        <span className="material-symbols-outlined text-5xl text-[var(--admin-error)] mb-4">
          error_outline
        </span>
        <p className="text-sm text-[var(--admin-error)] mb-4">
          Erreur lors du chargement des enchères.
        </p>
        <p className="text-xs text-[var(--admin-on-surface-variant)] mb-6 text-center">
          {(error as Error)?.message ?? 'Une erreur inattendue est survenue.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
          Supervision des enchères
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
          Gérez et surveillez les enchères en cours et passées du réseau Future Farm.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="gavel" value={stats.activeCount} label="Enchères actives" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
        <StatCard icon="schedule" value={stats.pendingCount} label="En attente" iconBgColor="bg-amber-50" iconColor="text-amber-700" />
        <StatCard icon="check_circle" value={stats.soldCount} label="Clôturées (Vendu)" iconBgColor="bg-blue-50" iconColor="text-blue-700" />
        <StatCard icon="payments" value={formatPrice(stats.totalAmount)} label="Volume total" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'active', label: 'En cours', count: stats.activeCount },
          { id: 'scheduled', label: 'À venir', count: stats.pendingCount },
          { id: 'finished', label: 'Terminées' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Table */}
      <AdminTable columns={tableColumns} data={filteredAuctions} />
    </div>
  );
}
