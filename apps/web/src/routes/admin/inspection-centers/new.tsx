import { Icon } from '@/features/shared/components/Icon';
import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import {
  useCreateCenter,
  useInspectors,
} from '@/features/admin/api/inspections.queries';
import { AdminCard, Button } from '@/features/admin/components';
import { LocationPickerMap } from '@/features/shared/components/LocationPickerMap';
import { addToast } from '@/features/shared/store/toast.store';
import { AddressInputGroup, type AddressValue } from '@/features/addresses/components';

export const Route = createFileRoute('/admin/inspection-centers/new')({
  beforeLoad: () => {
    requireAuth(Permission.INSPECTION_CENTER_CREATE);
  },
  component: CreateInspectionCenterPage,
});

function CreateInspectionCenterPage() {
  const navigate = useNavigate();
  const createCenterMutation = useCreateCenter();
  const { data: inspectors = [], isLoading: isLoadingInspectors } = useInspectors();

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [address, setAddress] = useState<AddressValue>({
    streetAddress: '',
    streetAddress2: '',
    city: '',
    stateOrProvince: '',
    country: 'COD',
  });
  const [latitude, setLatitude] = useState<number | ''>('');
  const [longitude, setLongitude] = useState<number | ''>('');
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([]);
  const [inspectorSearch, setInspectorSearch] = useState('');

  const toggleInspector = (inspectorId: string) => {
    setSelectedInspectorIds((prev) =>
      prev.includes(inspectorId)
        ? prev.filter((id) => id !== inspectorId)
        : [...prev, inspectorId]
    );
  };

  const handleCoordinatesChange = ({ lat, lon }: { lat: number; lon: number }) => {
    setLatitude(lat);
    setLongitude(lon);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      addToast('Le nom du centre est obligatoire.', 'error');
      return;
    }
    if (!code.trim()) {
      addToast('Le code unique du centre est obligatoire.', 'error');
      return;
    }
    if (!regionName.trim()) {
      addToast('La région d’opération est obligatoire pour enregistrer un centre.', 'error');
      return;
    }

    try {
      const formattedAddress = [
        address.streetAddress,
        address.streetAddress2,
        address.city,
        address.stateOrProvince,
        address.country,
      ]
        .filter(Boolean)
        .join(', ');

      const payload: {
        name: string;
        code: string;
        regionName: string;
        address: string;
        latitude?: number;
        longitude?: number;
        inspectorProfileIds?: string[];
      } = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        regionName: regionName.trim(),
        address: formattedAddress,
      };

      if (latitude !== '') payload.latitude = Number(latitude);
      if (longitude !== '') payload.longitude = Number(longitude);
      if (selectedInspectorIds.length > 0) {
        payload.inspectorProfileIds = selectedInspectorIds;
      }

      await createCenterMutation.mutateAsync(payload);
      addToast('Centre d’inspection créé avec succès', 'success');
      void navigate({ to: '/admin/inspection-centers' });
    } catch {
      addToast('Erreur lors de la création du centre d’inspection', 'error');
    }
  };

  const filteredInspectors = inspectors.filter((insp) => {
    const q = inspectorSearch.toLowerCase();
    const fullName = `${insp.user?.firstName || ''} ${insp.user?.lastName || ''}`.toLowerCase();
    const license = (insp.licenseNumber || '').toLowerCase();
    return fullName.includes(q) || license.includes(q);
  });

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Back Button & Header */}
      <div className="space-y-2">
        <Link
          to="/admin/inspection-centers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <Icon name="arrow_back" className="text-sm" />
          Retour aux centres d'inspection
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">
              Créer un Centre d'Inspection
            </h1>
            <p className="text-xs text-[var(--admin-on-surface-variant)] mt-1">
              Enregistrez un nouveau centre de contrôle qualité régional avec ses coordonnées géographiques et ses inspecteurs assignés.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. General Info */}
        <AdminCard className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <Icon name="domain" className="text-emerald-700" />
            <h2 className="text-sm font-bold text-gray-900">1. Informations générales</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nom du centre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Centre de Contrôle Kipushi"
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Code unique <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CTR-KIP-01"
                className="w-full text-sm font-mono uppercase border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Région d'opération <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="Ex: Kipushi, Lubumbashi, Dakar, Thiès, San-Pédro..."
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
            />
            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs leading-relaxed flex items-start gap-2.5">
              <Icon name="info" className="text-base text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-800">Indication pour l'administrateur : </span>
                La région est obligatoire. Choisissez un nom représentatif et facilement identifiable par les producteurs locaux. Ce nom sera directement proposé aux agriculteurs pour choisir leur région d'activité lors de leur inscription.
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <AddressInputGroup
              value={address}
              onChange={setAddress}
              title="Adresse physique du centre"
              subtitle="Coordonnées physiques et localisation du centre"
              required={false}
            />
          </div>
        </AdminCard>

        {/* 2. Interactive Map Location Picker */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Icon name="map" className="text-emerald-700" />
              <h2 className="text-sm font-bold text-gray-900">2. Emplacement sur la carte</h2>
            </div>
            <span className="text-xs text-gray-500">Sélection interactive</span>
          </div>

          <LocationPickerMap
            latitude={latitude}
            longitude={longitude}
            onChange={handleCoordinatesChange}
            className="h-80 w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0"
            label="Sélectionnez l'emplacement exact du centre d'inspection :"
          />

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Latitude (auto-remplie ou manuelle)
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="-11.6609"
                className="w-full text-xs font-mono border border-gray-300 rounded-lg p-2 bg-gray-50/60 text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Longitude (auto-remplie ou manuelle)
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="27.4794"
                className="w-full text-xs font-mono border border-gray-300 rounded-lg p-2 bg-gray-50/60 text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>
          </div>
        </AdminCard>

        {/* 3. Assign Certified Inspectors */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Icon name="badge" className="text-emerald-700" />
              <h2 className="text-sm font-bold text-gray-900">3. Affecter des inspecteurs certifiés (Optionnel)</h2>
            </div>
            {selectedInspectorIds.length > 0 && (
              <span className="bg-emerald-50 text-[#1a5c35] border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded-full">
                {selectedInspectorIds.length} sélectionné(s)
              </span>
            )}
          </div>

          <p className="text-xs text-gray-600">
            Associez un ou plusieurs inspecteurs certifiés à cette station dès sa création pour leur assigner les récoltes de cette région.
          </p>

          {inspectors.length > 4 && (
            <div className="relative">
              <Icon name="search" className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-gray-400  text-sm" />
              <input
                type="text"
                value={inspectorSearch}
                onChange={(e) => setInspectorSearch(e.target.value)}
                placeholder="Filtrer par nom ou numéro de badge..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>
          )}

          {isLoadingInspectors ? (
            <div className="py-6 text-center text-xs text-gray-500">Chargement des inspecteurs...</div>
          ) : filteredInspectors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredInspectors.map((insp) => {
                const isChecked = selectedInspectorIds.includes(insp.id);
                return (
                  <label
                    key={insp.id}
                    onClick={() => toggleInspector(insp.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-emerald-50/70 border-[#1a5c35] text-emerald-950 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by label click
                        className="rounded text-[#1a5c35] focus:ring-[#1a5c35]"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {insp.user?.firstName} {insp.user?.lastName}
                        </p>
                        {insp.licenseNumber && (
                          <p className="font-mono text-[10px] text-gray-500">
                            {insp.licenseNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-gray-500 bg-gray-50 rounded-lg border border-dashed">
              Aucun inspecteur disponible.
            </div>
          )}
        </AdminCard>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigate({ to: '/admin/inspection-centers' })}
            disabled={createCenterMutation.isPending}
            className="px-5 py-2.5 text-xs font-semibold"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createCenterMutation.isPending}
            className="px-6 py-2.5 text-xs font-bold flex items-center gap-2"
          >
            {createCenterMutation.isPending ? (
              <>
                <Icon name="progress_activity" className="animate-spin  text-sm" />
                Création en cours...
              </>
            ) : (
              <>
                <Icon name="add_circle" className="text-sm" />
                Créer le centre
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
