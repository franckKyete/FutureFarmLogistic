import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { usePendingHarvests } from '@/features/inspector/api/harvests.queries';
import { useMyCenter } from '@/features/admin/api/inspections.queries';
import type { HarvestDto } from '@/features/inspector/types';

type TabKey = 'all' | 'pending' | 'flagged' | 'approved' | 'rejected';

const TABS: { key: TabKey; label: string; status?: string }[] = [
  { key: 'pending', label: 'En attente', status: 'PENDING_APPROVAL' },
  { key: 'flagged', label: 'Visite requise', status: 'FLAGGED_PHYSICAL' },
  { key: 'approved', label: 'Validées', status: 'APPROVED' },
  { key: 'rejected', label: 'Rejetées', status: 'REJECTED' },
  { key: 'all', label: 'Toutes' },
];

export const Route = createFileRoute('/inspector/validate')({
  component: ValidatePage,
});

function ValidatePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const { data: myCenter } = useMyCenter();
  const {
    data: harvests,
    isLoading,
    isError,
    refetch,
  } = usePendingHarvests(currentTab.status, myCenter?.id);
  const { data: pendingHarvests } = usePendingHarvests('PENDING_APPROVAL', myCenter?.id);
  const pendingCount = pendingHarvests?.length ?? 0;

  const handleSelectHarvest = (harvest: HarvestDto) => {
    void navigate({
      to: '/inspector/reports/$id',
      params: { id: harvest.id },
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9ff] font-sans pb-24">
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            {myCenter && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a5c35] block mb-0.5">
                {myCenter.code} • {myCenter.regionName}
              </span>
            )}
            <h1 className="text-lg font-bold text-[#0b1c30]">Inspections</h1>
          </div>
          <span className="bg-[#1a5c35] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {pendingCount} à valider
          </span>
        </div>
      </header>

      <div className="bg-white px-4 border-b border-gray-200 overflow-x-auto">
        <div className="flex space-x-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
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

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full">
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
                onSelect={handleSelectHarvest}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) to start a new inspection */}
      <button
        onClick={() => void navigate({ to: '/inspector/proxy' as any })}
        className="fixed right-5 bottom-20 z-40 flex items-center gap-2 bg-[#1a5c35] text-white px-4 py-3.5 rounded-full shadow-lg hover:bg-[#144a2a] active:scale-95 transition-all cursor-pointer font-bold text-xs"
        aria-label="Nouvelle Inspection"
      >
        <span className="material-symbols-outlined text-xl">add</span>
        <span>Nouvelle Inspection</span>
      </button>
    </div>
  );
}

function HarvestCard({
  harvest,
  onSelect,
}: {
  harvest: HarvestDto;
  onSelect: (h: HarvestDto) => void;
}) {
  const formattedDate = new Date(harvest.harvestDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getStatusBadge = () => {
    switch (harvest.status) {
      case 'FLAGGED_PHYSICAL':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">pin_drop</span>
            Visite requise
          </span>
        );
      case 'APPROVED':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            Validé ({harvest.qualityScore ? `${Number(harvest.qualityScore).toFixed(1)}/10` : 'OK'})
          </span>
        );
      case 'REJECTED':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
            Rejeté
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            En attente
          </span>
        );
    }
  };

  return (
    <div
      className="bg-white rounded-2xl p-4 flex gap-3.5 shadow-2xs border border-gray-200 hover:border-emerald-300 transition-all cursor-pointer group"
      onClick={() => onSelect(harvest)}
    >
      <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-gray-200">
        {harvest.images && harvest.images.length > 0 ? (
          <img src={harvest.images[0]} alt={harvest.productName} className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-gray-400 text-2xl">eco</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-[#1a5c35] transition-colors">
            {harvest.productName}
          </h3>
          {getStatusBadge()}
        </div>
        <p className="text-xs text-gray-600 mt-0.5 truncate">{harvest.producerName}</p>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
          <span className="font-mono font-bold text-gray-800">
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
          className="bg-white rounded-2xl p-4 flex gap-3 shadow-2xs border border-gray-200 animate-pulse"
        >
          <div className="w-16 h-16 bg-gray-200 rounded-xl shrink-0" />
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
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
      <span className="material-symbols-outlined text-4xl text-rose-500">error_outline</span>
      <p className="text-sm font-bold text-gray-800">Erreur de chargement</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-[#1a5c35] text-white text-xs font-bold rounded-xl hover:bg-[#144a2a] transition-colors cursor-pointer"
      >
        Réessayer
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 p-6 text-center">
      <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">check_circle</span>
      <p className="text-sm font-bold text-gray-800">Aucune récolte dans cette section</p>
      <p className="text-xs text-gray-500 mt-1">Tous les lots ont été traités pour ces critères.</p>
    </div>
  );
}
