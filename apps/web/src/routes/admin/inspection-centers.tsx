import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import {
  useInspectionCenters,
  useCreateCenter,
  useDeleteCenter,
  useAssignInspectorToCenter,
  useInspectors,
} from '@/features/admin/api/inspections.queries';
import {
  StatCard,
  Button,
  AdminCard,
  TableFilters,
  StatusBadge,
  Modal,
} from '@/features/admin/components';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/admin/inspection-centers')({
  beforeLoad: () => {
    requireAuth(Permission.INSPECTION_CENTER_READ);
  },
  component: InspectionCentersPage,
});

function InspectionCentersPage() {
  const { data: centers = [], isLoading, isError, refetch } = useInspectionCenters();
  const { data: inspectors = [] } = useInspectors();

  const createCenterMutation = useCreateCenter();
  const deleteCenterMutation = useDeleteCenter();
  const assignInspectorMutation = useAssignInspectorToCenter();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assigningCenterId, setAssigningCenterId] = useState<string | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState('');

  // Create center form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');

  const filteredCenters = centers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.regionName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCentersCount = centers.filter((c) => c.isActive).length;
  const uniqueRegions = new Set(centers.map((c) => c.regionName)).size;

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: {
        name: string;
        code: string;
        regionName: string;
        address: string;
        latitude?: number;
        longitude?: number;
      } = {
        name,
        code,
        regionName,
        address,
      };
      if (latitude !== '') payload.latitude = Number(latitude);
      if (longitude !== '') payload.longitude = Number(longitude);

      await createCenterMutation.mutateAsync(payload);
      addToast('Centre d’inspection créé avec succès', 'success');
      setIsCreateModalOpen(false);
      setName('');
      setCode('');
      setRegionName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      void refetch();
    } catch {
      addToast('Erreur lors de la création du centre', 'error');
    }
  };

  const handleAssignInspector = async () => {
    if (!assigningCenterId || !selectedInspectorId) return;
    try {
      await assignInspectorMutation.mutateAsync({
        id: assigningCenterId,
        inspectorProfileId: selectedInspectorId,
      });
      addToast('Inspecteur affecté au centre avec succès', 'success');
      setAssigningCenterId(null);
      setSelectedInspectorId('');
      void refetch();
    } catch {
      addToast("Erreur lors de l'affectation", 'error');
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver ce centre ?')) return;
    try {
      await deleteCenterMutation.mutateAsync(id);
      addToast('Centre désactivé', 'info');
      void refetch();
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-white rounded-xl w-1/3" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border p-8 space-y-3">
        <span className="material-symbols-outlined text-5xl text-[var(--admin-error)]">error_outline</span>
        <p className="text-lg font-bold text-[var(--admin-on-surface)]">Erreur de chargement</p>
        <Button onClick={() => void refetch()} variant="primary">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
            Centres d'Inspection Régionaux
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
            Gestion des stations physiques, des zones rurales et affectation des inspecteurs terrain.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} variant="primary" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          Nouveau Centre
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon="corporate_fare"
          value={centers.length}
          label="Centres enregistrés"
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon="task_alt"
          value={activeCentersCount}
          label="Centres opérationnels"
          iconBgColor="bg-blue-50"
          iconColor="text-blue-700"
        />
        <StatCard
          icon="public"
          value={uniqueRegions}
          label="Régions couvertes"
          iconBgColor="bg-amber-50"
          iconColor="text-amber-700"
        />
      </div>

      {/* Filters */}
      <TableFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Rechercher par nom, code ou région..."
      />

      {/* Grid of Centers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCenters.length > 0 ? (
          filteredCenters.map((center) => (
            <AdminCard key={center.id} className="space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {center.code}
                    </span>
                    <h3 className="font-bold text-base text-[var(--admin-on-surface)] mt-1.5">{center.name}</h3>
                  </div>
                  <StatusBadge status={center.isActive ? 'active' : 'banned'} label={center.isActive ? 'Actif' : 'Inactif'} />
                </div>

                <div className="space-y-1 text-xs text-[var(--admin-on-surface-variant)] pt-1">
                  <p className="flex items-center gap-1.5 font-semibold text-gray-800">
                    <span className="material-symbols-outlined text-sm text-emerald-700">location_on</span>
                    {center.regionName}
                  </p>
                  <p className="text-gray-500 line-clamp-2">{center.address}</p>
                  {center.latitude != null && center.longitude != null && (
                    <p className="font-mono text-[10px] text-gray-400">
                      GPS : {Number(center.latitude).toFixed(4)}°, {Number(center.longitude).toFixed(4)}°
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--admin-outline-variant)]/20 flex gap-2">
                <Button
                  onClick={() => setAssigningCenterId(center.id)}
                  variant="primary"
                  className="flex-1 text-xs py-1.5 rounded-lg"
                >
                  Affecter Inspecteur
                </Button>
                <Button
                  onClick={() => handleDeleteCenter(center.id)}
                  variant="secondary"
                  className="text-xs py-1.5 rounded-lg text-rose-700 hover:bg-rose-50"
                >
                  Désactiver
                </Button>
              </div>
            </AdminCard>
          ))
        ) : (
          <div className="col-span-full text-center py-16 bg-slate-50 border border-dashed rounded-xl text-sm text-[var(--admin-on-surface-variant)]">
            Aucun centre d'inspection ne correspond à votre recherche.
          </div>
        )}
      </div>

      {/* Create Center Modal */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer un Centre d'Inspection"
      >
        <form onSubmit={handleCreateCenter} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nom du centre</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Centre de Contrôle San-Pédro"
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Code unique</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CTR-SP-01"
                className="w-full text-sm font-mono border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Région</label>
              <input
                type="text"
                required
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="Ex: Bas-Sassandra"
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Adresse physique</label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Zone Industrielle Portuaire, San-Pédro"
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Latitude (optionnel)</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value ? Number(e.target.value) : '')}
                placeholder="4.7500"
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Longitude (optionnel)</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value ? Number(e.target.value) : '')}
                placeholder="-6.6333"
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={createCenterMutation.isPending}>
              {createCenterMutation.isPending ? 'Création...' : 'Créer le centre'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Inspector Modal */}
      <Modal
        open={assigningCenterId !== null}
        onClose={() => setAssigningCenterId(null)}
        title="Affecter un Inspecteur"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Choisir l'Inspecteur</label>
            <select
              value={selectedInspectorId}
              onChange={(e) => setSelectedInspectorId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
            >
              <option value="">-- Sélectionner un inspecteur --</option>
              {inspectors.map((insp) => (
                <option key={insp.id} value={insp.id}>
                  {insp.licenseNumber} — {insp.agencyName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setAssigningCenterId(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleAssignInspector}
              disabled={!selectedInspectorId || assignInspectorMutation.isPending}
            >
              {assignInspectorMutation.isPending ? 'Affectation...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
