import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useDashboardStats } from '@/features/inspector/api/dashboard.queries';
import { usePendingHarvests } from '@/features/inspector/api/harvests.queries';
import { useMyCenter } from '@/features/admin/api/inspections.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { DashboardStats, VisitDto, HarvestDto } from '@/features/inspector/types';
import { VisitReason } from '@futurefarm/types';

export const Route = createFileRoute('/inspector/dashboard')({
  component: DashboardPage,
});

const REASON_LABELS: Record<VisitReason, string> = {
  [VisitReason.ROUTINE]: 'Routine',
  [VisitReason.URGENT]: 'Urgence',
  [VisitReason.FIRST_INSPECTION]: '1ère inspection',
};

const REASON_STYLES: Record<VisitReason, string> = {
  [VisitReason.ROUTINE]: 'bg-blue-100 text-blue-700',
  [VisitReason.URGENT]: 'bg-red-100 text-red-700',
  [VisitReason.FIRST_INSPECTION]: 'bg-purple-100 text-purple-700',
};

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myCenter } = useMyCenter();
  const { data: stats, isLoading, isError, refetch } = useDashboardStats();
  const { data: pendingHarvests = [], isLoading: pendingLoading } = usePendingHarvests(
    'PENDING_APPROVAL',
    myCenter?.id
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] pb-24 font-sans">
      {/* Header with Inspector & Assigned Center Badge */}
      <Header user={user} center={myCenter} />

      <div className="p-4 space-y-6 max-w-5xl mx-auto">
        {/* Quick Action CTAs */}
        <QuickActions onNavigate={(path) => void navigate({ to: path as any })} />

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : stats ? (
          <>
            {/* Key Metric Cards */}
            <MetricsSection stats={stats} />

            {/* Actionable Queues: 2-column on desktop, single-column on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Harvests Queue (FIFO - Oldest First) */}
              <PendingHarvestsQueue
                harvests={pendingHarvests}
                isLoading={pendingLoading}
                onSelect={(id) => void navigate({ to: '/inspector/reports/$id', params: { id } })}
                onSeeMore={() => void navigate({ to: '/inspector/validate' })}
              />

              {/* Scheduled Inspections Queue */}
              <ScheduledInspectionsQueue
                visits={stats.todayVisits}
                onPlanning={() => void navigate({ to: '/inspector/planning' })}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Header({ user, center }: { user: any; center: any }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            {center ? (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#1a5c35] bg-[#1a5c35]/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-xs">location_on</span>
                {center.code} • {center.regionName}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Espace Inspecteur
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-[#0b1c30] mt-0.5">
            Bonjour, {user ? `${user.firstName} ${user.lastName}` : 'Inspecteur'} 👋
          </h1>
        </div>

        <Link
          to="/profile"
          className="w-10 h-10 rounded-full bg-[#1a5c35] text-white font-bold flex items-center justify-center text-sm shadow-xs hover:opacity-90 transition-opacity"
          title="Mon Profil"
        >
          {user?.firstName?.charAt(0) || 'I'}
          {user?.lastName?.charAt(0) || ''}
        </Link>
      </div>
    </header>
  );
}

function QuickActions({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        onClick={() => onNavigate('/inspector/proxy')}
        className="flex items-center justify-center gap-2.5 py-3.5 px-4 bg-[#1a5c35] text-white rounded-2xl font-bold text-sm shadow-sm hover:bg-[#144a2a] active:scale-98 transition-all cursor-pointer"
      >
        <span className="material-symbols-outlined text-xl">add_circle</span>
        Nouvelle Inspection Terrain
      </button>

      <button
        onClick={() => onNavigate('/inspector/accounts')}
        className="flex items-center justify-center gap-2.5 py-3.5 px-4 bg-white text-[#1a5c35] border border-[#1a5c35]/30 rounded-2xl font-bold text-sm shadow-2xs hover:bg-[#1a5c35]/5 active:scale-98 transition-all cursor-pointer"
      >
        <span className="material-symbols-outlined text-xl">person_add</span>
        Enrôler un Producteur
      </button>
    </div>
  );
}

function MetricsSection({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      label: 'Producteurs région',
      value: `${stats.regionalFarmersCount ?? stats.pendingAccountsCount}`,
      trend: `${stats.pendingAccountsCount} en attente`,
      icon: 'groups',
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Commandes traitées',
      value: `${stats.orderVolume ?? 0}`,
      trend: 'Activité globale',
      icon: 'local_shipping',
      iconColor: 'text-blue-700',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Audits validés (mois)',
      value: `${stats.monthlyValidationsCount || 0}`,
      trend: `${stats.pendingHarvestsCount} en attente`,
      icon: 'fact_check',
      iconColor: 'text-purple-700',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Score qualité moyen',
      value: stats.averageQualityScore ? `${Number(stats.averageQualityScore).toFixed(1)} / 10` : '8.5 / 10',
      trend: 'Conformité certifiée',
      icon: 'verified',
      iconColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-2xl p-4 shadow-2xs border border-gray-200 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 ${card.bgColor} rounded-xl flex items-center justify-center`}>
              <span className={`material-symbols-outlined text-xl ${card.iconColor}`}>
                {card.icon}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 font-mono">{card.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{card.label}</p>
            <p className="text-[10px] font-semibold text-emerald-800 mt-1">{card.trend}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingHarvestsQueue({
  harvests,
  isLoading,
  onSelect,
  onSeeMore,
}: {
  harvests: HarvestDto[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onSeeMore: () => void;
}) {
  const topHarvests = harvests.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-[#0b1c30] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#1a5c35] text-lg">hourglass_top</span>
              File des Récoltes (FIFO)
            </h2>
            <p className="text-[11px] text-gray-500">Lots non vérifiés — triés par ancienneté</p>
          </div>
          <span className="text-xs font-bold text-[#1a5c35] bg-[#1a5c35]/10 px-2 py-0.5 rounded-full">
            {harvests.length} en attente
          </span>
        </div>

        <div className="space-y-3 pt-3">
          {isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-16 bg-gray-100 rounded-xl" />
              <div className="h-16 bg-gray-100 rounded-xl" />
            </div>
          ) : topHarvests.length === 0 ? (
            <div className="text-center py-8 text-gray-400 space-y-1">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
              <p className="text-xs font-medium text-gray-500">Tous les lots ont été vérifiés !</p>
            </div>
          ) : (
            topHarvests.map((harvest) => (
              <div
                key={harvest.id}
                onClick={() => onSelect(harvest.id)}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-gray-900 truncate">
                      {harvest.productName}
                    </h3>
                    <span className="text-[9px] font-mono text-gray-400">
                      {harvest.quantity} {harvest.unit}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {harvest.producerName}
                  </p>
                  <p className="text-[10px] text-[#1a5c35] font-medium mt-0.5">
                    Récolté le {new Date(harvest.harvestDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <span className="text-xs font-bold text-[#1a5c35] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                  Traiter
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={onSeeMore}
        className="w-full py-2.5 mt-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
      >
        Voir toute la file d'attente ({harvests.length}) →
      </button>
    </div>
  );
}

function ScheduledInspectionsQueue({
  visits,
  onPlanning,
}: {
  visits: VisitDto[];
  onPlanning: () => void;
}) {
  const displayVisits = visits.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-[#0b1c30] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#1a5c35] text-lg">event_available</span>
              Visites Planifiées
            </h2>
            <p className="text-[11px] text-gray-500">Prochaines visites terrain programmées</p>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
            {visits.length} visite{visits.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-3 pt-3">
          {displayVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-400 space-y-1">
              <span className="material-symbols-outlined text-3xl">event_busy</span>
              <p className="text-xs font-medium text-gray-500">Aucune visite programmée aujourd'hui</p>
            </div>
          ) : (
            displayVisits.map((visit) => (
              <div
                key={visit.id}
                onClick={onPlanning}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-blue-50/40 hover:border-blue-200 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                      {visit.plannedTime || '09:00'}
                    </span>
                    <h3 className="text-xs font-bold text-gray-900 truncate">
                      {visit.producerName || 'Producteur'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {visit.producerFarmName || 'Exploitation agricole'}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    REASON_STYLES[visit.reason as VisitReason] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {REASON_LABELS[visit.reason as VisitReason] || visit.reason}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={onPlanning}
        className="w-full py-2.5 mt-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
      >
        Ouvrir le calendrier complet →
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white rounded-2xl border border-gray-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-56 bg-white rounded-2xl border border-gray-200" />
        <div className="h-56 bg-white rounded-2xl border border-gray-200" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
      <span className="material-symbols-outlined text-4xl text-rose-500">error_outline</span>
      <p className="text-sm font-bold text-gray-800">Impossible de charger le tableau de bord</p>
      <button
        onClick={onRetry}
        className="text-xs bg-[#1a5c35] text-white px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-[#144a2a]"
      >
        Réessayer
      </button>
    </div>
  );
}
