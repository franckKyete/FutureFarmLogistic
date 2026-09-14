import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyRunsQuery,
  getMyDriverProfileQuery,
  updateDriverAvailabilityMutation,
  startRunMutation,
} from '@/features/tracking/api/tracking.queries';
import { getUnreadNotificationsCountQuery } from '@/features/notifications/api/notifications.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DeliveryRunStatus } from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';
import type { DeliveryRunDto } from '@/features/admin/api/logistics.queries';

export const Route = createFileRoute('/driver/')({
  component: DriverDashboardPage,
});

function DriverDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: runs = [], refetch: refetchRuns } = useQuery(getMyRunsQuery());
  const { data: profile, isLoading: isProfileLoading } = useQuery(getMyDriverProfileQuery());
  const { data: unreadNotifications } = useQuery(getUnreadNotificationsCountQuery());

  const updateAvailability = useMutation({
    ...updateDriverAvailabilityMutation(),
    onSuccess: (data) => {
      addToast(
        data?.isAvailable ? 'Statut : Disponible pour les livraisons' : 'Statut mis à jour : En pause',
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['driver', 'profile', 'me'] });
    },
    onError: () => addToast('Erreur lors de la mise à jour du statut', 'error'),
  });

  const startRun = useMutation({
    ...startRunMutation(),
    onSuccess: () => {
      addToast('Mission démarrée ! Bonne route.', 'success');
      void refetchRuns();
      queryClient.invalidateQueries({ queryKey: ['driver', 'my-runs'] });
    },
    onError: () => addToast('Erreur lors du démarrage de la mission', 'error'),
  });

  const isAvailable = profile?.isAvailable ?? true;
  const unreadCount = unreadNotifications?.count ?? 0;

  // Filter today's runs (or recent runs)
  const today = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const todayRuns = runs.filter((r) => isSameDay(new Date(r.scheduledAt), today));
  const displayRuns = todayRuns.length > 0 ? todayRuns : runs.slice(0, 5);

  const activeMission = runs.find((r) => r.status === DeliveryRunStatus.IN_PROGRESS);
  const plannedMissions = runs.filter((r) => r.status === DeliveryRunStatus.PLANNED);
  const completedTodayCount = displayRuns.filter((r) => r.status === DeliveryRunStatus.COMPLETED).length;

  // Total distance
  const totalDistanceKm = displayRuns.reduce((acc, r) => acc + (Number(r.totalDistanceKm) || 0), 0);

  const formattedDate = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-[#fbfbfe]">
      {/* Brand Top Bar */}
      <header className="bg-white px-5 py-3.5 border-b border-gray-100 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#004322]/10 flex items-center justify-center text-[#004322]">
            <Icon name="agriculture" className="text-xl" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-[#004322]">Future Farm</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/notifications"
            className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 relative cursor-pointer"
            title="Notifications"
          >
            <Icon name="notifications" className="text-xl" />
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
            )}
          </Link>

          <Link to="/driver/profile" className="flex items-center">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.firstName}
                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-600 shadow-2xs"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-xs border border-emerald-600 shadow-2xs">
                {user?.firstName?.charAt(0) || 'C'}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="p-5 space-y-6 flex-1">
        {/* Greeting & Availability Switch */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">
              Bonjour, {user?.firstName || 'Marc'}
            </h1>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">{capitalizedDate}</p>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Statut</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateAvailability.mutate(!isAvailable)}
                disabled={updateAvailability.isPending || isProfileLoading}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAvailable ? 'bg-[#004322]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isAvailable ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-xs font-bold ${
                  isAvailable ? 'text-[#004322]' : 'text-gray-500'
                }`}
              >
                {isAvailable ? 'Disponible' : 'En pause'}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold">
              <Icon name="assignment" className="text-base text-gray-700" />
              <span>Missions</span>
            </div>
            <p className="text-2xl font-black text-[#0b1c30] mt-2">
              {displayRuns.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold">
              <Icon name="check_circle" className="text-base text-emerald-600" />
              <span>Livrées</span>
            </div>
            <p className="text-2xl font-black text-[#0b1c30] mt-2">
              {completedTodayCount}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold">
              <Icon name="pin_drop" className="text-base text-gray-700" />
              <span>Distance</span>
            </div>
            <p className="text-xl font-black text-[#0b1c30] mt-2">
              {Math.round(totalDistanceKm)} <span className="text-xs font-normal text-gray-500">km</span>
            </p>
          </div>
        </div>

        {/* Missions du jour */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#0b1c30]">Missions du jour</h2>
            {runs.length > 0 && (
              <Link
                to="/driver/runs"
                className="text-xs font-bold text-[#004322] hover:underline flex items-center gap-0.5"
              >
                Voir tout
              </Link>
            )}
          </div>

          {/* Active Run Card */}
          {activeMission ? (
            <ActiveMissionCard run={activeMission} />
          ) : plannedMissions.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center space-y-2 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#004322] mx-auto flex items-center justify-center">
                <Icon name="local_shipping" className="text-2xl" />
              </div>
              <p className="font-bold text-sm text-[#0b1c30]">Aucune mission active ou en attente</p>
              <p className="text-xs text-gray-500">
                Vous recevrez une notification dès qu'une tournée de livraison vous sera assignée.
              </p>
            </div>
          ) : null}

          {/* Pending Planned Missions */}
          {plannedMissions.map((run) => (
            <PendingMissionCard
              key={run.id}
              run={run}
              onStart={() => startRun.mutate(run.id)}
              isStarting={startRun.isPending}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ActiveMissionCard({ run }: { run: DeliveryRunDto }) {
  const stops = [...(run.stops || [])].sort((a, b) => a.sequence - b.sequence);
  const collectionStops = stops.filter((s) => s.type === 'COLLECTION');
  const deliveryStops = stops.filter((s) => s.type === 'DELIVERY');

  const originStop = collectionStops[0] || stops[0];
  const destStop = deliveryStops[deliveryStops.length - 1] || stops[stops.length - 1];

  const originName = originStop?.address?.city || originStop?.address?.street || 'Point de collecte';
  const destName = destStop?.address?.city || destStop?.address?.street || 'Destination';

  // Aggregate products and total weight across all collection stops
  const totalWeightKg = collectionStops.reduce((sum, s) => {
    const qty = Number(s.orderLine?.quantity);
    if (!isNaN(qty) && qty > 0) return sum + qty;
    if (s.notes) {
      const m = s.notes.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (m && m[1]) return sum + parseFloat(m[1]);
    }
    return sum;
  }, 0);

  const productNames = Array.from(
    new Set(
      collectionStops
        .map((s) => s.orderLine?.harvest?.product?.name)
        .filter(Boolean),
    ),
  );
  const productsSummary =
    productNames.length > 0
      ? productNames.join(', ')
      : stops[0]?.orderLine?.harvest?.product?.name || 'Produit maraîcher';
  const displayWeight = totalWeightKg > 0 ? totalWeightKg : stops[0]?.orderLine?.quantity || 200;

  const timeStr = new Date(run.scheduledAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl p-5 border border-emerald-300 shadow-sm relative space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-black text-[#0b1c30]">{timeStr}</span>
        <span className="bg-[#004322] text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
          En cours
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center pt-1.5">
          <span className="w-3 h-3 rounded-full bg-[#004322] ring-4 ring-[#004322]/15" />
          <span className="w-0.5 h-10 bg-gray-200 my-1" />
          <span className="w-3 h-3 rounded-full bg-gray-400" />
        </div>
        <div className="space-y-3 flex-1 min-w-0">
          <div>
            <p className="text-[11px] font-semibold text-gray-400">Collecte</p>
            <p className="text-sm font-bold text-[#0b1c30] truncate">{originName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-400">Livraison</p>
            <p className="text-sm font-bold text-[#0b1c30] truncate">{destName}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-800">
            {productsSummary} ({displayWeight}kg)
          </span>
        </div>

        <Link
          to="/driver/runs/$id"
          params={{ id: run.id }}
          className="px-4 py-2 bg-[#004322] text-white text-xs font-bold rounded-xl hover:bg-[#00331a] active:scale-95 transition-all shadow-xs"
        >
          Détails
        </Link>
      </div>
    </div>
  );
}

function PendingMissionCard({
  run,
  onStart,
  isStarting,
}: {
  run: DeliveryRunDto;
  onStart: () => void;
  isStarting: boolean;
}) {
  const stops = [...(run.stops || [])].sort((a, b) => a.sequence - b.sequence);
  const collectionStops = stops.filter((s) => s.type === 'COLLECTION');
  const deliveryStops = stops.filter((s) => s.type === 'DELIVERY');

  const originStop = collectionStops[0] || stops[0];
  const destStop = deliveryStops[deliveryStops.length - 1] || stops[stops.length - 1];

  const originName = originStop?.address?.city || originStop?.address?.street || 'Origine';
  const destName = destStop?.address?.city || destStop?.address?.street || 'Destination';

  // Aggregate products and total weight across all collection stops
  const totalWeightKg = collectionStops.reduce((sum, s) => {
    const qty = Number(s.orderLine?.quantity);
    if (!isNaN(qty) && qty > 0) return sum + qty;
    if (s.notes) {
      const m = s.notes.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (m && m[1]) return sum + parseFloat(m[1]);
    }
    return sum;
  }, 0);

  const productNames = Array.from(
    new Set(
      collectionStops
        .map((s) => s.orderLine?.harvest?.product?.name)
        .filter(Boolean),
    ),
  );
  const productsSummary =
    productNames.length > 0
      ? productNames.join(', ')
      : stops[0]?.orderLine?.harvest?.product?.name || 'Récolte';
  const displayWeight = totalWeightKg > 0 ? totalWeightKg : stops[0]?.orderLine?.quantity || 500;

  const timeStr = new Date(run.scheduledAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-[#0b1c30]">{timeStr}</span>
        <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-3 py-1 rounded-full border border-amber-200">
          En attente
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-gray-700">
        <div className="flex items-center gap-2 font-bold text-[#0b1c30]">
          <Icon name="pin_drop" className="text-sm text-gray-400 shrink-0" />
          <span className="truncate">
            {originName} → {destName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-gray-600 font-medium">
          <Icon name="inventory_2" className="text-sm text-gray-400 shrink-0" />
          <span className="truncate">
            {productsSummary} ({displayWeight}kg)
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={isStarting}
        className="w-full py-3 bg-[#004322] hover:bg-[#00331a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xs cursor-pointer"
      >
        <Icon name="play_arrow" className="text-sm" />
        {isStarting ? 'Démarrage...' : 'Démarrer la mission'}
      </button>
    </div>
  );
}
