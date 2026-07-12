import { createFileRoute } from '@tanstack/react-router';
import { useDashboardStats } from '../../features/inspector/api/dashboard.queries';
import type { DashboardStats, VisitDto } from '../../features/inspector/types';
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

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifiée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  MISSED: 'Manquée',
};

function DashboardPage() {
  const { data: stats, isLoading, isError, refetch } = useDashboardStats();

  return (
    <div className="pb-24">
      <Header />

      <div className="p-4">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : stats ? (
          <>
            <StatsGrid stats={stats} />
            <PriorityAlerts alerts={stats.priorityAlerts} />
            <TodayVisits visits={stats.todayVisits} />
          </>
        ) : null}
      </div>

    </div>
  );
}

function Header() {
  return (
    <div className="p-4 pb-0">
      <h1 className="text-xl font-bold text-[#1a5c35]">Tableau de bord</h1>
      <p className="text-gray-500 mt-1">Bonjour, Inspecteur</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
            <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse">
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
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
        className="px-6 py-2.5 bg-[#1a5c35] text-white rounded-lg font-medium hover:bg-[#144a2a] transition-colors active:scale-95"
      >
        Réessayer
      </button>
    </div>
  );
}

function StatsGrid({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      label: 'Comptes en attente',
      value: stats.pendingAccountsCount,
      icon: 'person_pin',
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Récoltes à valider',
      value: stats.pendingHarvestsCount,
      icon: 'eco',
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: "Visites aujourd'hui",
      value: stats.todayVisitsCount,
      icon: 'today',
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Validations du mois',
      value: stats.monthlyValidationsCount,
      icon: 'assignment_turned_in',
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
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

function PriorityAlerts({
  alerts,
}: {
  alerts: DashboardStats['priorityAlerts'];
}) {
  const hasAny = alerts.overdueVisits > 0 || alerts.suspiciousHarvests > 0;
  if (!hasAny) return null;

  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-base font-semibold text-gray-800">
        Alertes prioritaires
      </h2>

      {alerts.overdueVisits > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-2xl text-amber-500 mt-0.5">
            warning
          </span>
          <div>
            <p className="font-semibold text-amber-800">
              {alerts.overdueVisits} visite
              {alerts.overdueVisits > 1 ? 's' : ''} en retard
            </p>
            <p className="text-sm text-amber-600 mt-0.5">
              {alerts.overdueVisits > 1
                ? 'Ces visites nécessitent une attention immédiate.'
                : 'Cette visite nécessite une attention immédiate.'}
            </p>
          </div>
        </div>
      )}

      {alerts.suspiciousHarvests > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <span className="material-symbols-outlined text-2xl text-red-500 mt-0.5">
            gpp_bad
          </span>
          <div>
            <p className="font-semibold text-red-800">
              {alerts.suspiciousHarvests} récolte
              {alerts.suspiciousHarvests > 1 ? 's' : ''} suspecte
              {alerts.suspiciousHarvests > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-red-600 mt-0.5">
              {alerts.suspiciousHarvests > 1
                ? 'Ces récoltes ont été signalées pour inspection.'
                : 'Cette récolte a été signalée pour inspection.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TodayVisits({ visits }: { visits: VisitDto[] }) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-semibold text-gray-800 mb-3">
        Visites du jour
      </h2>

      {visits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl">
          <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">
            event
          </span>
          <p className="text-gray-500 text-sm">
            Aucune visite prévue aujourd'hui
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} />
          ))}
        </div>
      )}
    </div>
  );
}

function VisitCard({ visit }: { visit: VisitDto }) {
  const timeDisplay = visit.plannedTime || 'Toute la journée';

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded-md">
            {timeDisplay}
          </div>
          <p className="font-semibold text-gray-900 mt-2 truncate">
            {visit.producerName || 'Producteur inconnu'}
          </p>
          {visit.producerFarmName && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {visit.producerFarmName}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              REASON_STYLES[visit.reason as VisitReason] || 'bg-gray-100 text-gray-600'
            }`}
          >
            {REASON_LABELS[visit.reason as VisitReason] || visit.reason}
          </span>
          <span className="text-xs text-gray-500">
            {STATUS_LABELS[visit.status] || visit.status}
          </span>
        </div>
      </div>
    </div>
  );
}
