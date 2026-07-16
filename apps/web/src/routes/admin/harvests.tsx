import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import { usePendingHarvests, useVerifyHarvest, AdminHarvestDto } from '@/features/admin/api/harvests.queries';
import {
  StatCard,
  Button,
  AdminTable,
  TableFilters,
  SidePanel,
} from '@/features/admin/components';

export const Route = createFileRoute('/admin/harvests')({
  beforeLoad: () => {
    requireAuth(Permission.HARVEST_VERIFY);
  },
  component: HarvestValidationPage,
});

function HarvestValidationPage() {
  const queryClient = useQueryClient();
  const { data: harvests = [], isLoading } = usePendingHarvests();
  const verifyMutation = useVerifyHarvest();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedHarvest, setSelectedHarvest] = useState<AdminHarvestDto | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Verification Form states
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [qualityScore, setQualityScore] = useState<number>(8.0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      const productName = h.product?.name || '';
      const farmerName = h.farmerProfile?.companyName || '';
      const matchesSearch =
        productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || h.product?.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [harvests, searchQuery, categoryFilter]);

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHarvest) return;
    setSubmitError(null);

    const payload: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      qualityScore?: number;
      rejectionReason?: string;
    } = {
      id: selectedHarvest.id,
      status: decision,
    };

    if (decision === 'APPROVED') {
      payload.qualityScore = qualityScore;
    } else {
      payload.rejectionReason = rejectionReason;
    }

    verifyMutation.mutate(
      payload,
      {
        onSuccess: () => {
          setIsPanelOpen(false);
          setSelectedHarvest(null);
          queryClient.invalidateQueries({ queryKey: ['admin', 'harvests'] });
        },
        onError: (err: any) => {
          setSubmitError(err.response?.data?.message || 'Une erreur est survenue lors de la validation.');
        },
      }
    );
  };

  const columns = [
    {
      key: 'product',
      header: 'Produit',
      render: (h: AdminHarvestDto) => {
        const imageUrl = h.photoUrls?.[0];
        return (
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={h.product?.name}
                className="w-12 h-12 rounded-lg object-cover border border-[var(--admin-outline-variant)]/30 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[var(--admin-primary-container)]/10 flex items-center justify-center text-[var(--admin-primary)] shrink-0">
                <span className="material-symbols-outlined text-xl">grass</span>
              </div>
            )}
            <div>
              <p className="font-bold text-[var(--admin-on-surface)]">{h.product?.name}</p>
              <p className="text-[10px] text-[var(--admin-on-surface-variant)] uppercase tracking-wider font-semibold">
                {h.product?.category}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'farmer',
      header: 'Producteur',
      render: (h: AdminHarvestDto) => (
        <div>
          <p className="font-bold text-[var(--admin-on-surface)] text-xs">
            {h.farmerProfile?.companyName}
          </p>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            {h.farmerProfile?.user ? `${h.farmerProfile.user.firstName} ${h.farmerProfile.user.lastName}` : '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantité dispo',
      render: (h: AdminHarvestDto) => (
        <div>
          <p className="font-bold text-[var(--admin-on-surface)] text-xs">
            {Number(h.quantityInStock).toLocaleString('fr-FR')} {h.unit}
          </p>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            Marge: {Number(h.stockMarge)} {h.unit}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Prix unitaire',
      render: (h: AdminHarvestDto) => (
        <span className="font-bold text-xs text-[var(--admin-on-surface)]">
          {Number(h.pricePerUnit).toLocaleString('fr-FR')} FCFA / {h.unit}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates clés',
      render: (h: AdminHarvestDto) => (
        <div>
          <p className="text-[11px] text-[var(--admin-on-surface)] font-medium">
            Récolte: {new Intl.DateTimeFormat('fr-FR').format(new Date(h.harvestDate))}
          </p>
          <p className="text-[11px] text-[var(--admin-error)] font-medium">
            Exp: {new Intl.DateTimeFormat('fr-FR').format(new Date(h.expirationDate))}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (h: AdminHarvestDto) => (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedHarvest(h);
            setDecision('APPROVED');
            setQualityScore(8.0);
            setRejectionReason('');
            setSubmitError(null);
            setIsPanelOpen(true);
          }}
          variant="primary"
          className="bg-[var(--admin-primary)] text-white hover:brightness-110 px-3 py-1.5 rounded-lg text-xs"
        >
          Valider le lot
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-12 bg-white rounded-xl"></div>
        <div className="h-64 bg-white rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
          Validation des récoltes
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
          Examinez les récoltes fraîchement soumises par les producteurs et attribuez une note de qualité pour les publier.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          icon="hourglass_empty"
          value={harvests.length}
          label="En attente de contrôle"
          iconBgColor="bg-orange-50"
          iconColor="text-orange-700"
        />
        <StatCard
          icon="verified"
          value={filteredHarvests.length}
          label="Récoltes filtrées"
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon="rule"
          value="Filtre actif"
          label="Examen direct activé"
          iconBgColor="bg-slate-50"
          iconColor="text-slate-700"
        />
      </div>

      {/* Filters & Table */}
      <div className="space-y-6">
        <TableFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Rechercher par produit, producteur..."
        >
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-transparent border border-[var(--admin-outline-variant)]/40 rounded-lg text-sm text-[var(--admin-on-surface-variant)] focus:ring-[var(--admin-primary)]/20"
          >
            <option value="all">Toutes les catégories</option>
            <option value="CEREALS">Céréales</option>
            <option value="FRUITS">Fruits</option>
            <option value="VEGETABLES">Légumes</option>
            <option value="DATES">Dattes</option>
            <option value="DAIRY">Produits Laitiers</option>
            <option value="MEAT">Viande</option>
            <option value="OTHER">Autres</option>
          </select>
        </TableFilters>

        {filteredHarvests.length === 0 ? (
          <div className="py-16 text-center text-sm text-[var(--admin-on-surface-variant)]/60 bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/40 rounded-xl">
            Aucune récolte en attente de validation.
          </div>
        ) : (
          <AdminTable
            columns={columns}
            data={filteredHarvests}
            onRowClick={(h) => {
              setSelectedHarvest(h);
              setDecision('APPROVED');
              setQualityScore(8.0);
              setRejectionReason('');
              setSubmitError(null);
              setIsPanelOpen(true);
            }}
          />
        )}
      </div>

      {/* Slide-out detail & verify panel */}
      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title="Dossier de validation de la récolte"
      >
        {selectedHarvest && (
          <div className="p-8 space-y-6 flex flex-col min-h-full">
            {/* Header info */}
            <div className="flex gap-4 items-start border-b border-[var(--admin-outline-variant)]/20 pb-4">
              {selectedHarvest.photoUrls?.[0] ? (
                <img
                  src={selectedHarvest.photoUrls[0]}
                  alt={selectedHarvest.product?.name}
                  className="w-16 h-16 rounded-lg object-cover border border-[var(--admin-outline-variant)]/30 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-[var(--admin-primary-container)]/10 flex items-center justify-center text-[var(--admin-primary)] shrink-0">
                  <span className="material-symbols-outlined text-2xl">grass</span>
                </div>
              )}
              <div>
                <h3 className="font-bold text-lg text-[var(--admin-primary)]">{selectedHarvest.product?.name}</h3>
                <span className="px-2.5 py-0.5 bg-[var(--admin-primary-container)]/20 text-[var(--admin-primary)] rounded-full text-[10px] font-bold uppercase tracking-wide">
                  {selectedHarvest.product?.category}
                </span>
              </div>
            </div>

            {/* Harvest metrics grid */}
            <div className="grid grid-cols-2 gap-4 bg-[var(--admin-surface-container-low)] p-4 rounded-xl border border-[var(--admin-outline-variant)]/10">
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--admin-on-surface-variant)]/70">Quantité physique</p>
                <p className="text-sm font-bold text-[var(--admin-on-surface)]">
                  {Number(selectedHarvest.quantityInStock).toLocaleString('fr-FR')} {selectedHarvest.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--admin-on-surface-variant)]/70">Marge de sécurité</p>
                <p className="text-sm font-bold text-[var(--admin-on-surface)]">
                  {Number(selectedHarvest.stockMarge).toLocaleString('fr-FR')} {selectedHarvest.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--admin-on-surface-variant)]/70">Prix unitaire de base</p>
                <p className="text-sm font-bold text-[var(--admin-on-surface)]">
                  {Number(selectedHarvest.pricePerUnit).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--admin-on-surface-variant)]/70">Méthodes de culture</p>
                <p className="text-xs font-semibold text-[var(--admin-on-surface)] truncate" title={selectedHarvest.farmingMethods}>
                  {selectedHarvest.farmingMethods || 'Non spécifié'}
                </p>
              </div>
            </div>

            {/* Producer details */}
            <div className="space-y-2 border-t border-[var(--admin-outline-variant)]/20 pt-4">
              <h4 className="font-bold text-xs uppercase text-[var(--admin-on-surface-variant)] tracking-wider">
                Profil Producteur
              </h4>
              <div className="bg-white p-4 rounded-xl border border-[var(--admin-outline-variant)]/30 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Entreprise</span>
                  <span className="font-bold text-[var(--admin-on-surface)]">{selectedHarvest.farmerProfile?.companyName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Responsable</span>
                  <span className="font-medium text-[var(--admin-on-surface)]">
                    {selectedHarvest.farmerProfile?.user ? `${selectedHarvest.farmerProfile.user.firstName} ${selectedHarvest.farmerProfile.user.lastName}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Adresse</span>
                  <span className="font-medium text-[var(--admin-on-surface)] truncate max-w-[200px]" title={selectedHarvest.farmerProfile?.address}>
                    {selectedHarvest.farmerProfile?.address}
                  </span>
                </div>
              </div>
            </div>

            {/* Photos gallery */}
            {selectedHarvest.photoUrls && selectedHarvest.photoUrls.length > 0 && (
              <div className="space-y-2 border-t border-[var(--admin-outline-variant)]/20 pt-4">
                <h4 className="font-bold text-xs uppercase text-[var(--admin-on-surface-variant)] tracking-wider">
                  Galerie Photos
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedHarvest.photoUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Photo récolte ${i + 1}`}
                      className="w-24 h-24 rounded-lg object-cover border border-[var(--admin-outline-variant)]/30 shrink-0"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Decision Section */}
            <form onSubmit={handleVerifySubmit} className="space-y-4 border-t border-[var(--admin-outline-variant)]/20 pt-4 mt-auto">
              <h4 className="font-bold text-xs uppercase text-[var(--admin-on-surface-variant)] tracking-wider">
                Décision administrative
              </h4>

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold">
                  {submitError}
                </div>
              )}

              <div className="flex bg-[var(--admin-surface-container-low)] p-1 rounded-xl border border-[var(--admin-outline-variant)]/20">
                <button
                  type="button"
                  onClick={() => setDecision('APPROVED')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    decision === 'APPROVED'
                      ? 'bg-white text-[var(--admin-primary)] shadow-sm'
                      : 'text-[var(--admin-on-surface-variant)]'
                  }`}
                >
                  Approuver & Publier
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('REJECTED')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    decision === 'REJECTED'
                      ? 'bg-white text-[var(--admin-error)] shadow-sm'
                      : 'text-[var(--admin-on-surface-variant)]'
                  }`}
                >
                  Rejeter le lot
                </button>
              </div>

              {decision === 'APPROVED' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[var(--admin-on-surface-variant)]">
                    Score de qualité officielle (sur 10)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={qualityScore}
                      onChange={(e) => setQualityScore(Number(e.target.value))}
                      className="flex-1 accent-[var(--admin-primary)] cursor-pointer"
                    />
                    <span className="font-bold text-lg text-[var(--admin-primary)] w-12 text-right">
                      {qualityScore.toFixed(1)}/10
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[var(--admin-on-surface-variant)]">
                    Motif du rejet
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Veuillez décrire le motif du rejet (qualité non conforme, informations manquantes, etc.)"
                    className="p-3 border border-[var(--admin-outline-variant)]/60 rounded-xl text-xs focus:outline-none focus:border-[var(--admin-primary)]"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={verifyMutation.isPending}
                  className="w-full bg-[var(--admin-primary)] text-white hover:brightness-110 py-3 rounded-xl font-medium"
                >
                  {verifyMutation.isPending ? 'Enregistrement...' : 'Confirmer la décision'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsPanelOpen(false)}
                  className="w-full border border-[var(--admin-outline-variant)]/40 hover:bg-gray-100"
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
