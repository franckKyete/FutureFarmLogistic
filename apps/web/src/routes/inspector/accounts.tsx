import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useProducers } from '../../features/inspector/api/accounts.queries';
import { CreateProducerModal } from '../../features/inspector/components/CreateProducerModal';
import type { ProducerDto, ProducerFilter } from '../../features/inspector/types';

export const Route = createFileRoute('/inspector/accounts')({
  component: AccountsPage,
});

type StatusFilter = '' | 'pending_validation' | 'approved' | 'suspended';

const STATUS_CHIPS: { label: string; value: StatusFilter }[] = [
  { label: 'Tous', value: '' },
  { label: 'En attente', value: 'pending_validation' },
  { label: 'Actifs', value: 'approved' },
  { label: 'Suspendus', value: 'suspended' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending_validation: { label: 'En attente', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  suspended: { label: 'Suspendu', className: 'bg-red-100 text-red-800' },
  banned: { label: 'Banni', className: 'bg-gray-100 text-gray-800' },
};

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-600',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-rose-500',
];

function getInitials(firstName: string, lastName: string): string {
  return ((firstName?.charAt(0) ?? '') + (lastName?.charAt(0) ?? '')).toUpperCase();
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 bg-gray-200 rounded w-3/5" />
          <div className="h-3 bg-gray-200 rounded w-2/5" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

function AccountsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filter: ProducerFilter = { role: 'farmer', page: 1, limit: 50 };
  if (statusFilter) filter.status = statusFilter;
  if (debouncedSearch) filter.search = debouncedSearch;

  const {
    data: producers,
    isLoading,
    isError,
    refetch,
  } = useProducers(filter);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-[#1a5c35]">search</span>
          <h1 className="text-xl font-bold text-[#1a5c35]">Gestion des comptes</h1>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher un producteur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-all"
          />
        </div>
      </div>

      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none">
        {STATUS_CHIPS.map((chip) => {
          const isActive = statusFilter === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${
                isActive
                  ? 'bg-[#1a5c35] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3 pb-36 space-y-3">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-5xl text-red-300">error_outline</span>
            <p className="text-gray-500 mt-3 text-sm">Erreur de chargement</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-5 py-2 bg-[#1a5c35] text-white rounded-lg text-sm font-medium hover:bg-[#145029] active:scale-95 transition-all"
            >
              Réessayer
            </button>
          </div>
        ) : !producers || producers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="material-symbols-outlined text-5xl text-gray-300">search_off</span>
            <p className="text-gray-500 mt-3 text-sm">Aucun producteur trouvé</p>
          </div>
        ) : (
          producers.map((producer: ProducerDto) => {
            const statusConfig = STATUS_BADGE[producer.status] ?? {
              label: producer.status,
              className: 'bg-gray-100 text-gray-800',
            };
            const initials = getInitials(producer.firstName, producer.lastName);
            const avatarColor = getAvatarColor(producer.id);

            return (
              <div
                key={producer.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-sm shrink-0`}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {producer.firstName} {producer.lastName}
                      </span>
                      {producer.farmName && (
                        <span className="text-sm text-gray-400 font-medium">· {producer.farmName}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{producer.email}</p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusConfig.className}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <CreateProducerModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed right-4 bottom-20 z-40 w-14 h-14 bg-[#1a5c35] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#145029] active:scale-95 transition-all"
        aria-label="Créer un producteur"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

    </div>
  );
}
