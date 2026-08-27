import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, DeliveryRunStatus } from '@futurefarm/types';
import {
  useDeliveryRuns,
  useDrivers,
  useVehicles,
  useAssignDriverToRun,
  useAssignVehicleToRun,
} from '@/features/admin/api/logistics.queries';
import {
  StatCard,
  Button,
  AdminCard,
  AdminTable,
  TableFilters,
  AdminTabs,
  StatusBadge,
  Modal,
} from '@/features/admin/components';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/admin/logistics')({
  beforeLoad: () => {
    requireAuth(Permission.DELIVERY_RUN_READ_ALL);
  },
  component: LogisticsPage,
});

function LogisticsPage() {
  const { data: runs = [], isLoading: loadingRuns, isError: errorRuns, refetch: refetchRuns } = useDeliveryRuns();
  const { data: drivers = [], isLoading: loadingDrivers, isError: errorDrivers, refetch: refetchDrivers } = useDrivers();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();

  const assignDriverMutation = useAssignDriverToRun();
  const assignVehicleMutation = useAssignVehicleToRun();

  const [activeTab, setActiveTab] = useState('tracking');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningRunId, setAssigningRunId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  const filteredTransporters = drivers.filter(
    (t) =>
      (t.user ? `${t.user.firstName} ${t.user.lastName}` : '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats Calculations
  const inProgressRuns = runs.filter((r) => r.status === DeliveryRunStatus.IN_PROGRESS);
  const pendingAssignment = runs.filter((r) => r.status === DeliveryRunStatus.PLANNED && (!r.driverId || !r.vehicleId));
  const completedToday = runs.filter((r) => r.status === DeliveryRunStatus.COMPLETED);
  const incidentRuns = runs.filter(
    (r) =>
      r.status === DeliveryRunStatus.CANCELLED ||
      r.notes?.toLowerCase().includes('panne') ||
      r.notes?.toLowerCase().includes('incident') ||
      r.notes?.toLowerCase().includes('accident')
  );

  // Collect map stops from in-progress runs
  const mapStops: MapStop[] = useMemo(() => {
    const stopsList: MapStop[] = [];
    inProgressRuns.forEach((run) => {
      run.stops?.forEach((s) => {
        if (s.address?.lat && s.address?.lon) {
          stopsList.push({
            id: s.id,
            lat: s.address.lat,
            lon: s.address.lon,
            label: s.address.city || s.address.street || 'Arrêt',
            type: s.type as 'COLLECTION' | 'DELIVERY',
            status: s.status,
          });
        }
      });
    });
    return stopsList;
  }, [inProgressRuns]);

  // First driver position for default center if available
  const activeDriverPos = useMemo(() => {
    for (const run of inProgressRuns) {
      if (run.stops?.[0]?.address?.lat && run.stops?.[0]?.address?.lon) {
        return {
          lat: run.stops[0].address.lat,
          lon: run.stops[0].address.lon,
        };
      }
    }
    return null;
  }, [inProgressRuns]);

  const handleOpenAssignModal = (runId: string, currentDriverId?: string | null, currentVehicleId?: string | null) => {
    setAssigningRunId(runId);
    setSelectedDriverId(currentDriverId || '');
    setSelectedVehicleId(currentVehicleId || '');
  };

  const handleSaveAssignment = async () => {
    if (!assigningRunId) return;
    try {
      if (selectedDriverId) {
        await assignDriverMutation.mutateAsync({ id: assigningRunId, driverId: selectedDriverId });
      }
      if (selectedVehicleId) {
        await assignVehicleMutation.mutateAsync({ id: assigningRunId, vehicleId: selectedVehicleId });
      }
      addToast('Affectation enregistrée avec succès', 'success');
      setAssigningRunId(null);
      void refetchRuns();
    } catch {
      addToast("Erreur lors de l'affectation", 'error');
    }
  };

  const columns = [
    {
      key: 'transporter',
      header: 'Transporteur',
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <span className="text-2xl">👨‍✈️</span>
          <div>
            <p className="font-bold text-[var(--admin-on-surface)]">
              {row.user ? `${row.user.firstName} ${row.user.lastName}` : 'Nom Inconnu'}
            </p>
            <p className="text-[10px] text-[var(--admin-on-surface-variant)] font-medium">Permis: {row.licenseNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Permis / Véhicule Affecté',
      render: (row: any) => {
        const assignedVehicle = vehicles.find((v) => v.currentDriverId === row.userId);
        return (
          <div>
            <p className="font-medium text-[var(--admin-on-surface)]">Catégorie {row.licenseCategory}</p>
            <p className="text-xs font-mono text-[var(--admin-on-surface-variant)]">
              {assignedVehicle ? `Véhicule: ${assignedVehicle.registrationPlate} (${assignedVehicle.type})` : 'Aucun véhicule assigné'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'expiration',
      header: 'Expiration Permis',
      render: (row: any) => (
        <span className="font-medium text-xs">
          {row.licenseExpiresAt ? new Date(row.licenseExpiresAt).toLocaleDateString('fr-FR') : '—'}
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'Statut Disponibilité',
      render: (row: any) => (
        <span className="text-xs font-semibold text-gray-700">
          {row.isAvailable ? '✅ Prêt pour mission' : '⏳ Occupé'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row: any) => (
        <StatusBadge
          status={row.isAvailable ? 'active' : 'pending'}
          label={row.isAvailable ? 'Disponible' : 'En mission'}
        />
      ),
    },
  ];

  if (loadingRuns || loadingDrivers || loadingVehicles) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-white rounded-xl mb-6"></div>
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl"></div>
      </div>
    );
  }

  if (errorRuns || errorDrivers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-[var(--admin-outline-variant)]/40 p-8">
        <span className="material-symbols-outlined text-5xl text-[var(--admin-error)] mb-4">
          error_outline
        </span>
        <p className="text-lg font-medium text-[var(--admin-on-surface)] mb-1">
          Erreur de chargement
        </p>
        <p className="text-sm text-[var(--admin-on-surface-variant)] mb-6 text-center">
          Impossible de récupérer les données logistiques depuis le serveur
        </p>
        <Button onClick={() => { refetchRuns(); refetchDrivers(); }} variant="primary">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
          Gestion Logistique
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
          Suivi des flottes de transport, tournées de livraisons et affectation des transporteurs.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon="local_shipping" value={inProgressRuns.length} label="Livraisons en cours" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
        <StatCard icon="assignment_late" value={pendingAssignment.length} label="Attente attribution" iconBgColor="bg-amber-50" iconColor="text-amber-700" />
        <StatCard icon="task_alt" value={completedToday.length} label="Livrées" iconBgColor="bg-blue-50" iconColor="text-blue-700" />
        <StatCard icon="report" value={incidentRuns.length} label="Incidents / Annulations" iconBgColor="bg-red-50" iconColor="text-red-700" />
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'tracking', label: 'Suivi en temps réel', count: inProgressRuns.length },
          { id: 'allocation', label: 'Attribution transporteurs', count: pendingAssignment.length },
          { id: 'transporters', label: 'Gestion des transporteurs', count: drivers.length },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'tracking' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Real Leaflet Map Area */}
          <AdminCard className="lg:col-span-2 flex flex-col justify-between h-[500px] p-2">
            <DeliveryMap
              stops={mapStops}
              driverPosition={activeDriverPos}
              className="flex-1 w-full rounded-xl overflow-hidden relative z-0"
            />
            <div className="flex justify-between items-center mt-3 px-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004322]" />
                <span>Camion en route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600" />
                <span>Livraison</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Point de collecte</span>
              </div>
            </div>
          </AdminCard>

          {/* Active Deliveries List */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {inProgressRuns.length > 0 ? (
              inProgressRuns.map((run) => {
                const isIncident =
                  run.notes?.toLowerCase().includes('panne') ||
                  run.notes?.toLowerCase().includes('incident');
                const startCity = run.stops?.[0]?.address?.city || 'Départ';
                const endCity = run.stops?.[run.stops.length - 1]?.address?.city || 'Destination';

                return (
                  <AdminCard
                    key={run.id}
                    className={`space-y-3 border-l-4 ${
                      isIncident ? 'border-red-500 bg-red-50/20' : 'border-emerald-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-bold text-sm ${isIncident ? 'text-red-900' : 'text-[var(--admin-on-surface)]'}`}>
                          TRK-{run.id.slice(0, 4).toUpperCase()} —{' '}
                          {run.driver ? `${run.driver.firstName} ${run.driver.lastName}` : 'Chauffeur Non Assigné'}
                        </h4>
                        <p className={`text-[11px] ${isIncident ? 'text-red-800' : 'text-[var(--admin-on-surface-variant)]'}`}>
                          {startCity} ➔ {endCity}
                        </p>
                      </div>
                      <StatusBadge status={isIncident ? 'banned' : 'active'} label={isIncident ? 'Incident' : 'En route'} />
                    </div>
                    {run.notes && (
                      <p className={`text-xs font-medium ${isIncident ? 'text-red-700' : 'text-[var(--admin-on-surface-variant)]'}`}>
                        {isIncident ? '⚠️ ' : ''}{run.notes}
                      </p>
                    )}
                    <div className="pt-2 border-t border-[var(--admin-outline-variant)]/20 flex justify-between text-xs text-[var(--admin-on-surface-variant)]">
                      <span>Prévu le: {new Date(run.scheduledAt).toLocaleDateString('fr-FR')}</span>
                      <span className={`font-semibold ${isIncident ? 'text-red-700' : 'text-[var(--admin-primary)]'}`}>
                        {isIncident ? 'Action requise' : 'Flux optimal'}
                      </span>
                    </div>
                  </AdminCard>
                );
              })
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed text-xs text-[var(--admin-on-surface-variant)]">
                Aucun camion actuellement en route
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'transporters' ? (
        <div className="space-y-6">
          <TableFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Rechercher un transporteur..." />
          <AdminTable columns={columns} data={filteredTransporters} />
        </div>
      ) : (
        // Allocation tab
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingAssignment.length > 0 ? (
              pendingAssignment.map((run) => {
                const startCity = run.stops?.[0]?.address?.city || 'Départ';
                const endCity = run.stops?.[run.stops.length - 1]?.address?.city || 'Destination';
                return (
                  <AdminCard key={run.id} className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-[var(--admin-on-surface)]">
                          Tournée #TRK-{run.id.slice(0, 6).toUpperCase()}
                        </h4>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          {startCity} ➔ {endCity}
                        </p>
                      </div>
                      <StatusBadge status="pending" label="Attente affectation" />
                    </div>
                    <div className="text-xs space-y-1 text-[var(--admin-on-surface-variant)]">
                      <p>Date prévue: {new Date(run.scheduledAt).toLocaleString('fr-FR')}</p>
                      <p>Arrêts: {run.stops?.length || 0} points de collecte/livraison</p>
                      <p>Chauffeur: {run.driver ? `${run.driver.firstName} ${run.driver.lastName}` : 'Non assigné'}</p>
                      <p>Véhicule: {run.vehicle ? `${run.vehicle.registrationPlate} (${run.vehicle.type})` : 'Non assigné'}</p>
                    </div>
                    <div className="pt-3 border-t border-[var(--admin-outline-variant)]/20 flex gap-2">
                      <Button
                        onClick={() => handleOpenAssignModal(run.id, run.driverId, run.vehicleId)}
                        className="flex-1 bg-[var(--admin-primary)] text-white text-xs py-1.5 rounded-lg"
                      >
                        Assigner Chauffeur / Véhicule
                      </Button>
                    </div>
                  </AdminCard>
                );
              })
            ) : (
              <div className="col-span-full text-center py-16 bg-slate-50 border border-dashed rounded-xl text-sm text-[var(--admin-on-surface-variant)]">
                Toutes les tournées prévues ont déjà un chauffeur et véhicule assignés !
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver & Vehicle Assignment Modal */}
      <Modal
        open={assigningRunId !== null}
        onClose={() => setAssigningRunId(null)}
        title="Affecter Chauffeur & Véhicule"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sélectionner un Chauffeur</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
            >
              <option value="">-- Choisir un chauffeur --</option>
              {drivers.map((d) => (
                <option key={d.userId} value={d.userId}>
                  {d.user ? `${d.user.firstName} ${d.user.lastName}` : d.licenseNumber} (Permis {d.licenseCategory})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sélectionner un Véhicule</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
            >
              <option value="">-- Choisir un véhicule --</option>
              {vehicles.filter((v) => v.isActive).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationPlate} — {v.type} ({v.capacityKg} kg / {v.capacityM3} m³)
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setAssigningRunId(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAssignment}
              disabled={assignDriverMutation.isPending || assignVehicleMutation.isPending}
            >
              {assignDriverMutation.isPending || assignVehicleMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

