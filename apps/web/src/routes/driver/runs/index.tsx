import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyRunsQuery } from '@/features/tracking/api/tracking.queries';
import { DeliveryRunStatus } from '@futurefarm/types';
import type { DeliveryRunDto } from '@/features/admin/api/logistics.queries';

export const Route = createFileRoute('/driver/runs/')({
  component: DriverRunsListPage,
});

type TabFilter = 'ALL' | 'ACTIVE' | 'PLANNED' | 'DONE';

function DriverRunsListPage() {
  const { data: runs = [], isLoading, isError, refetch } = useQuery(getMyRunsQuery());
  const [filter, setFilter] = useState<TabFilter>('ALL');

  const filteredRuns = runs.filter((run) => {
    if (filter === 'ACTIVE') return run.status === DeliveryRunStatus.IN_PROGRESS;
    if (filter === 'PLANNED') return run.status === DeliveryRunStatus.PLANNED;
    if (filter === 'DONE') return run.status === DeliveryRunStatus.COMPLETED || run.status === DeliveryRunStatus.CANCELLED;
    return true;
  });

  const activeCount = runs.filter((r) => r.status === DeliveryRunStatus.IN_PROGRESS).length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#004322]">Espace Chauffeur</span>
            <h1 className="text-xl font-bold text-[#0b1c30]">Mes Tournées</h1>
          </div>
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {activeCount} en cours
            </span>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {[
            { key: 'ALL', label: 'Toutes' },
            { key: 'ACTIVE', label: 'En cours' },
            { key: 'PLANNED', label: 'Planifiées' },
            { key: 'DONE', label: 'Terminées' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as TabFilter)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                filter === tab.key
                  ? 'bg-[#004322] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-rose-500">error_outline</span>
            <p className="text-sm font-semibold text-gray-700">Impossible de charger vos tournées</p>
            <button
              onClick={() => void refetch()}
              className="text-xs bg-[#004322] text-white px-4 py-2 rounded-lg font-bold"
            >
              Réessayer
            </button>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 p-6 space-y-2">
            <span className="material-symbols-outlined text-4xl text-gray-400">local_shipping</span>
            <p className="text-sm font-bold text-gray-700">Aucune tournée assignée</p>
            <p className="text-xs text-gray-500">Vos futures missions de livraison apparaîtront ici.</p>
          </div>
        ) : (
          filteredRuns.map((run) => <RunCard key={run.id} run={run} />)
        )}
      </main>
    </div>
  );
}

function RunCard({ run }: { run: DeliveryRunDto }) {
  const isProgress = run.status === DeliveryRunStatus.IN_PROGRESS;
  const isPlanned = run.status === DeliveryRunStatus.PLANNED;
  const isDone = run.status === DeliveryRunStatus.COMPLETED;

  const startStop = run.stops?.[0];
  const endStop = run.stops?.[run.stops.length - 1];

  const startCity = startStop?.address?.city || 'Point de collecte';
  const endCity = endStop?.address?.city || 'Destination';

  const stopsCount = run.stops?.length || 0;
  const pendingStops = run.stops?.filter((s) => s.status !== 'COMPLETED' && s.status !== 'SKIPPED').length || 0;

  return (
    <Link
      to="/driver/runs/$id"
      params={{ id: run.id }}
      className={`block bg-white rounded-xl p-4 border transition-all active:scale-[0.99] shadow-xs ${
        isProgress
          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-gray-800">
            #TRK-{run.id.slice(0, 6).toUpperCase()}
          </span>
          {isProgress && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              En cours
            </span>
          )}
          {isPlanned && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Planifiée
            </span>
          )}
          {isDone && (
            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
              Terminée
            </span>
          )}
        </div>

        <span className="text-[11px] text-gray-500 font-medium">
          {new Date(run.scheduledAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Route summary */}
      <div className="flex items-center gap-2 text-sm font-bold text-[#0b1c30] my-2">
        <span className="truncate">{startCity}</span>
        <span className="material-symbols-outlined text-gray-400 text-sm">arrow_forward</span>
        <span className="truncate">{endCity}</span>
      </div>

      {/* Meta indicators */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-gray-400">pin_drop</span>
            {stopsCount} arrêt{stopsCount > 1 ? 's' : ''} {isProgress && `(${pendingStops} restant${pendingStops > 1 ? 's' : ''})`}
          </span>
          {run.vehicle && (
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <span className="material-symbols-outlined text-sm text-gray-400">directions_car</span>
              {run.vehicle.registrationPlate}
            </span>
          )}
        </div>

        <span className="text-[#004322] font-bold text-xs flex items-center gap-0.5">
          Ouvrir
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </span>
      </div>
    </Link>
  );
}
