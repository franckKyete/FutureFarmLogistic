import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, DeliveryRunStatus, VehicleType } from '@futurefarm/types';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface DriverDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface DeliveryStopDto {
  id: string;
  type: string;
  status: string;
  sequence: number;
}

interface DeliveryRunDto {
  id: string;
  driverId: string | null;
  driver: DriverDto | null;
  vehicleId: string | null;
  vehicle: VehicleDto | null;
  status: DeliveryRunStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  stops: DeliveryStopDto[];
  totalDistanceKm: number | null;
  createdAt: string;
  updatedAt: string;
}

interface VehicleDto {
  id: string;
  registrationPlate: string;
  type: VehicleType;
  capacityKg: number;
  capacityM3: number;
  isActive: boolean;
  currentDriverId: string | null;
  currentDriver: DriverDto | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<DeliveryRunStatus, string> = {
  [DeliveryRunStatus.PLANNED]: 'Planifié',
  [DeliveryRunStatus.IN_PROGRESS]: 'En cours',
  [DeliveryRunStatus.COMPLETED]: 'Terminé',
  [DeliveryRunStatus.CANCELLED]: 'Annulé',
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.TRUCK]: 'Camion',
  [VehicleType.VAN]: 'Fourgonnette',
  [VehicleType.MOTORCYCLE]: 'Moto',
  [VehicleType.UTILITY]: 'Utilitaire',
};

export const Route = createFileRoute('/admin/logistics')({
  beforeLoad: () => {
    requireAuth(Permission.DELIVERY_RUN_READ_ALL);
  },
  component: LogisticsPage,
});

function statusBadgeClass(status: DeliveryRunStatus): string {
  switch (status) {
    case DeliveryRunStatus.PLANNED:
      return 'bg-blue-50 text-blue-700 ring-blue-200';
    case DeliveryRunStatus.IN_PROGRESS:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case DeliveryRunStatus.COMPLETED:
      return 'bg-green-50 text-green-700 ring-green-200';
    case DeliveryRunStatus.CANCELLED:
      return 'bg-red-50 text-red-700 ring-red-200';
  }
}

function LogisticsPage() {
  const {
    data: runsResponse,
    isLoading: runsLoading,
    isError: runsError,
  } = useQuery<{ data: DeliveryRunDto[]; total: number }>({
    queryKey: ['logistics', 'runs'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { data: DeliveryRunDto[]; total: number };
      }>('/logistics/runs');
      return data.data;
    },
  });

  const {
    data: vehicles,
    isLoading: vehiclesLoading,
    isError: vehiclesError,
  } = useQuery<VehicleDto[]>({
    queryKey: ['logistics', 'vehicles'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: VehicleDto[] }>(
        '/logistics/vehicles',
      );
      return data.data;
    },
  });

  const runs = runsResponse?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestion Logistique
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Tournées de livraison et parc véhicules.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-brand-600">
              local_shipping
            </span>
            <h2 className="text-lg font-semibold text-gray-900">
              Tournées de livraison
            </h2>
          </div>

          {runsLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400 shadow-sm">
              Chargement...
            </div>
          ) : runsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
              Erreur lors du chargement des tournées.
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400 shadow-sm">
              Aucune tournée de livraison trouvée.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Conducteur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Véhicule
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Nb arrêts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="max-w-[10rem] truncate whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                        {run.id.slice(0, 8)}…
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(run.status)}`}
                        >
                          {STATUS_LABELS[run.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {run.driver ? (
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-gray-400">
                              person
                            </span>
                            {run.driver.firstName} {run.driver.lastName}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {run.vehicle ? (
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-gray-400">
                              directions_car
                            </span>
                            {run.vehicle.registrationPlate}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base text-gray-400">
                            calendar_month
                          </span>
                          {new Date(run.scheduledAt).toLocaleDateString(
                            'fr-FR',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            },
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {run.stops.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-brand-600">
              directions_car
            </span>
            <h2 className="text-lg font-semibold text-gray-900">Véhicules</h2>
          </div>

          {vehiclesLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-400 shadow-sm">
              Chargement...
            </div>
          ) : vehiclesError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
              Erreur lors du chargement des véhicules.
            </div>
          ) : !vehicles || vehicles.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-400 shadow-sm">
              Aucun véhicule trouvé.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {vehicle.registrationPlate}
                      </p>
                      <p className="text-xs text-gray-500">
                        {VEHICLE_TYPE_LABELS[vehicle.type]}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        vehicle.isActive
                          ? 'bg-green-50 text-green-700 ring-green-200'
                          : 'bg-gray-100 text-gray-500 ring-gray-200'
                      }`}
                    >
                      {vehicle.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="material-symbols-outlined text-base text-gray-400">
                      person
                    </span>
                    {vehicle.currentDriver ? (
                      <span>
                        {vehicle.currentDriver.firstName}{' '}
                        {vehicle.currentDriver.lastName}
                      </span>
                    ) : (
                      <span className="text-gray-400">Aucun conducteur</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
