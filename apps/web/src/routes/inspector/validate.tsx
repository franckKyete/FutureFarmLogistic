import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { usePendingHarvests } from '../../features/inspector/api/harvests.queries';
import { HarvestDetailModal } from '../../features/inspector/components/HarvestDetailModal';
import type { HarvestDto } from '../../features/inspector/types';

type TabKey = 'all' | 'pending' | 'approved' | 'rejected';

const TABS: { key: TabKey; label: string; status?: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente', status: 'PENDING_APPROVAL' },
  { key: 'approved', label: 'Validées', status: 'APPROVED' },
  { key: 'rejected', label: 'Rejetées', status: 'REJECTED' },
];

export const Route = createFileRoute('/inspector/validate')({
  component: ValidatePage,
});

function ValidatePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [selectedHarvest, setSelectedHarvest] = useState<HarvestDto | null>(null);
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const { data: harvests, isLoading, isError, refetch } = usePendingHarvests(currentTab.status);
  const { data: pendingHarvests } = usePendingHarvests('PENDING_APPROVAL');
  const pendingCount = pendingHarvests?.length ?? 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-[#1a5c35]">Validation des récoltes</h1>
          <span className="bg-[#1a5c35] text-white text-xs font-medium px-2 py-0.5 rounded-full">
            {pendingCount}
          </span>
        </div>
      </header>

      <div className="bg-white px-4 border-b border-gray-200">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'text-[#1a5c35] border-[#1a5c35]'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : !harvests?.length ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {harvests.map((harvest) => (
              <HarvestCard
                key={harvest.id}
                harvest={harvest}
                onSelect={setSelectedHarvest}
              />
            ))}
          </div>
        )}
      </div>

      <HarvestDetailModal
        harvest={selectedHarvest}
        isOpen={!!selectedHarvest}
        onClose={() => setSelectedHarvest(null)}
      />
    </div>
  );
}

function HarvestCard({ harvest, onSelect }: { harvest: HarvestDto; onSelect: (h: HarvestDto) => void }) {
  const formattedDate = new Date(harvest.harvestDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const scoreBadgeColor =
    harvest.qualityScore == null
      ? 'bg-gray-100 text-gray-500'
      : harvest.qualityScore >= 7
        ? 'bg-green-100 text-green-800'
        : harvest.qualityScore >= 4
          ? 'bg-orange-100 text-orange-800'
          : 'bg-red-100 text-red-800';

  return (
    <div
      className="bg-white rounded-lg p-3 flex gap-3 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onSelect(harvest)}
    >
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-gray-400 text-2xl">image</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 truncate">{harvest.productName}</h3>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 leading-none ${scoreBadgeColor}`}
          >
            {harvest.qualityScore ?? '—'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{harvest.producerName}</p>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-600">
          <span className="font-medium">
            {harvest.quantity} {harvest.unit}
          </span>
          <span className="text-gray-300">•</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-lg p-3 flex gap-3 shadow-sm border border-gray-100 animate-pulse"
        >
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
      <p className="text-gray-600 font-medium">Erreur de chargement</p>
      <button
        onClick={onRetry}
        className="mt-3 px-4 py-2 bg-[#1a5c35] text-white text-sm font-medium rounded-lg hover:bg-[#14502d] transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <span className="material-symbols-outlined text-4xl text-gray-300 mb-3">verified</span>
      <p className="text-gray-500 font-medium">Toutes les récoltes ont été traitées</p>
    </div>
  );
}
