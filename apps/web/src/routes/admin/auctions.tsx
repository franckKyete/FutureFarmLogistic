import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, AuctionStatus, type AuctionDto } from '@futurefarm/types';
import { apiClient } from '@/lib/api-client';

export const Route = createFileRoute('/admin/auctions')({
  beforeLoad: () => {
    requireAuth(Permission.AUCTION_MANAGE);
  },
  component: AuctionsSupervisionPage,
});

type TabFilter = 'active' | 'past';

const TAB_FILTERS: { key: TabFilter; label: string; statuses: AuctionStatus[] }[] = [
  { key: 'active', label: 'Actives', statuses: [AuctionStatus.ACTIVE, AuctionStatus.SCHEDULED] },
  { key: 'past', label: 'Terminées', statuses: [AuctionStatus.SOLD, AuctionStatus.EXPIRED, AuctionStatus.CANCELLED] },
];

const STATUS_CONFIG: Record<AuctionStatus, { label: string; badgeClass: string }> = {
  [AuctionStatus.SCHEDULED]: { label: 'Planifiée', badgeClass: 'bg-blue-100 text-blue-700 ring-blue-200' },
  [AuctionStatus.ACTIVE]: { label: 'Active', badgeClass: 'bg-brand-100 text-brand-700 ring-brand-200' },
  [AuctionStatus.SOLD]: { label: 'Vendue', badgeClass: 'bg-teal-100 text-teal-700 ring-teal-200' },
  [AuctionStatus.EXPIRED]: { label: 'Expirée', badgeClass: 'bg-gray-100 text-gray-600 ring-gray-200' },
  [AuctionStatus.CANCELLED]: { label: 'Annulée', badgeClass: 'bg-red-100 text-red-700 ring-red-200' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function StatusBadge({ status }: { status: AuctionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${config.badgeClass}`}
    >
      {config.label}
    </span>
  );
}

function AuctionsSupervisionPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>('active');

  const { data, isLoading, isError, error } = useQuery<AuctionDto[]>({
    queryKey: ['auctions', 'admin'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: { data: AuctionDto[]; meta: unknown } }>('/auctions');
      return res.data.data.data;
    },
  });

  const activeStatuses = TAB_FILTERS.find((t) => t.key === activeTab)?.statuses ?? [];
  const filteredAuctions = useMemo(
    () => (data ?? []).filter((a) => activeStatuses.includes(a.status)),
    [data, activeStatuses],
  );

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Supervision des enchères</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez et surveillez les enchères en cours et passées.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <span className="material-symbols-outlined text-4xl">hourglass_empty</span>
            <p className="text-sm">Chargement des enchères...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Supervision des enchères</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez et surveillez les enchères en cours et passées.</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 shadow-sm p-12">
          <div className="flex flex-col items-center gap-3 text-red-600">
            <span className="material-symbols-outlined text-4xl">error_outline</span>
            <p className="text-sm font-medium">Erreur lors du chargement des enchères.</p>
            <p className="text-xs text-red-500">{(error as Error)?.message ?? 'Une erreur inattendue est survenue.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Supervision des enchères</h1>
        <p className="mt-1 text-sm text-gray-500">Gérez et surveillez les enchères en cours et passées.</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {TAB_FILTERS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-75">
              ({data ? (activeTab === tab.key ? filteredAuctions.length : 0) : 0})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredAuctions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">gavel</span>
          <p className="text-sm text-gray-400">
            {activeTab === 'active' ? 'Aucune enchère active ou planifiée.' : 'Aucune enchère terminée.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Produit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Prix actuel</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Prix de réserve</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date début</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date fin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Enchérisseur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAuctions.map((auc) => (
                  <tr key={auc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">
                      #{auc.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={auc.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {auc.harvestId ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base text-gray-400">inventory_2</span>
                          Lot #{auc.harvestId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {formatPrice(auc.currentPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {formatPrice(auc.reservePrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-gray-400">calendar_month</span>
                        {formatDate(auc.startAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-gray-400">calendar_month</span>
                        {formatDate(auc.endAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {auc.winnerId ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-base text-gray-400">person</span>
                          #{auc.winnerId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
