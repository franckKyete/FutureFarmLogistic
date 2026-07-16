import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, InspectionStatus, InspectionReportDto } from '@futurefarm/types';
import { useInspectionReports } from '@/features/admin/api/inspections.queries';
import {
  StatCard,
  Button,
  AdminTable,
  TableFilters,
  AdminTabs,
  SidePanel,
} from '@/features/admin/components';

export const Route = createFileRoute('/admin/inspections')({
  beforeLoad: () => {
    requireAuth(Permission.INSPECTION_READ_ALL);
  },
  component: InspectionsPage,
});

interface InspectionReportWithRelations extends InspectionReportDto {
  harvest?: {
    id: string;
    photoUrls?: string[];
    pricePerUnit: number;
    farmingMethods?: string | null;
    product?: {
      id: string;
      name: string;
      category: string;
    };
    farmerProfile?: {
      id: string;
      companyName: string;
      address: string;
      isCertified: boolean;
      user?: {
        firstName: string;
        lastName: string;
        email: string;
      };
    };
  };
}

function InspectionsPage() {
  const { data: reports = [], isLoading, isError, refetch } = useInspectionReports();

  const [activeTab, setActiveTab] = useState('validation');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInspection, setSelectedInspection] = useState<InspectionReportWithRelations | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'photos' | 'ai' | 'producer'>('photos');

  // Filter reports by current tab
  const tabFilteredReports = reports.filter((r) => {
    if (activeTab === 'validation') {
      return r.status === InspectionStatus.IN_PROGRESS;
    } else if (activeTab === 'supervision') {
      return r.status === InspectionStatus.IN_PROGRESS; // pending inspection queue
    } else {
      // history
      return r.status === InspectionStatus.SUBMITTED || r.status === InspectionStatus.REJECTED;
    }
  });

  const filteredData = (tabFilteredReports as InspectionReportWithRelations[]).filter((item) => {
    const productName = item.harvest?.product?.name || '';
    const producerName = item.harvest?.farmerProfile?.companyName || '';
    const matchesSearch =
      productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      producerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.harvestId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // KPI calculations
  const pendingCount = reports.filter((r) => r.status === InspectionStatus.IN_PROGRESS).length;
  const validatedCount = reports.filter((r) => r.status === InspectionStatus.SUBMITTED).length;
  const rejectedCount = reports.filter((r) => r.status === InspectionStatus.REJECTED).length;

  let avgAiScoreStr = '—';
  const scoredReports = reports.filter((r) => r.aiPreScreenScore !== null);
  if (scoredReports.length > 0) {
    const totalScore = scoredReports.reduce((acc, curr) => acc + (curr.aiPreScreenScore || 0), 0);
    avgAiScoreStr = Math.round((totalScore / scoredReports.length) * 10) + '%';
  }

  const columns = [
    {
      key: 'product',
      header: 'Produit',
      render: (row: InspectionReportWithRelations) => {
        const imageUrl = row.photos?.[0]?.url || row.harvest?.photoUrls?.[0];
        return (
          <div className="flex items-center gap-3">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={row.harvest?.product?.name}
                className="w-8 h-8 rounded-lg object-cover bg-slate-50 border border-[var(--admin-outline-variant)]/20"
              />
            ) : (
              <span className="text-2xl w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg">🌾</span>
            )}
            <div>
              <p className="font-bold text-[var(--admin-on-surface)]">{row.harvest?.product?.name || 'Inconnu'}</p>
              <p className="text-[10px] text-[var(--admin-on-surface-variant)] font-medium">
                Lot #{row.harvestId.slice(0, 8).toUpperCase()}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'producer',
      header: 'Producteur',
      render: (row: InspectionReportWithRelations) => (
        <span className="font-medium text-[var(--admin-on-surface)]">
          {row.harvest?.farmerProfile?.companyName || 'Producteur'}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Catégorie',
      render: (row: InspectionReportWithRelations) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          {row.harvest?.product?.category || 'Général'}
        </span>
      ),
    },
    {
      key: 'aiScore',
      header: 'Score IA',
      render: (row: InspectionReportWithRelations) => {
        const percentage = row.aiPreScreenScore !== null ? Math.round(row.aiPreScreenScore * 10) : null;
        return (
          <div className="flex items-center gap-1.5 font-bold text-emerald-600">
            <span className="material-symbols-outlined text-base">verified</span>
            <span>{percentage !== null ? `${percentage}%` : '—'}</span>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-[var(--admin-outline-variant)]/40 p-8">
        <span className="material-symbols-outlined text-5xl text-[var(--admin-error)] mb-4">
          error_outline
        </span>
        <p className="text-lg font-medium text-[var(--admin-on-surface)] mb-1">
          Erreur de chargement
        </p>
        <p className="text-sm text-[var(--admin-on-surface-variant)] mb-6 text-center">
          Impossible de récupérer les rapports d'inspection
        </p>
        <Button onClick={() => refetch()} variant="primary">
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
          Inspections & Validation
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
          Supervisez la qualité des produits entrant sur le marché.
        </p>
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'validation', label: 'File de validation', count: pendingCount },
          { id: 'supervision', label: 'Supervision' },
          { id: 'history', label: 'Historique', count: validatedCount + rejectedCount },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon="pending_actions" value={pendingCount} label="Produits en attente" iconBgColor="bg-orange-50" iconColor="text-orange-700" />
        <StatCard icon="task_alt" value={validatedCount} label="Validés" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
        <StatCard icon="cancel" value={rejectedCount} label="Rejetés" iconBgColor="bg-red-50" iconColor="text-red-700" />
        <StatCard icon="psychology" value={avgAiScoreStr} label="Score IA moyen" iconBgColor="bg-blue-50" iconColor="text-blue-700" />
      </div>

      {/* Table Filters */}
      <TableFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Rechercher par produit, producteur..." />

      {/* Table */}
      <AdminTable
        columns={columns}
        data={filteredData}
        onRowClick={(row) => {
          setSelectedInspection(row);
          setIsPanelOpen(true);
        }}
      />

      {/* Slide-out detailed inspection panel */}
      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={(selectedInspection?.harvest?.product?.name || '') + ' - Inspection détaillée'}
        width="w-[500px]"
      >
        {selectedInspection && (
          <div className="flex flex-col h-full bg-[var(--admin-surface-container-lowest)] p-6 space-y-6">
            {/* Panel Tabs */}
            <div className="flex gap-4 border-b border-[var(--admin-outline-variant)]/30 pb-3">
              {(['photos', 'ai', 'producer'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPanelTab(tab)}
                  className={`text-sm font-semibold capitalize transition-all ${
                    panelTab === tab
                      ? 'text-[var(--admin-primary)] border-b-2 border-[var(--admin-primary)] pb-1'
                      : 'text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]'
                  }`}
                >
                  {tab === 'photos' ? 'Photos' : tab === 'ai' ? 'IA Analyse' : 'Producteur'}
                </button>
              ))}
            </div>

            {/* Panel Tab Content */}
            {panelTab === 'photos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {selectedInspection.photos && selectedInspection.photos.length > 0 ? (
                    selectedInspection.photos.map((photo, i) => (
                      <div key={photo.id} className="relative rounded-xl border border-[var(--admin-outline-variant)]/40 overflow-hidden bg-slate-50 flex items-center justify-center h-36">
                        <img src={photo.url} alt={`Inspection photo ${i + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500 text-white shadow-sm">
                          Photo {i + 1}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8 bg-slate-50 border border-dashed rounded-xl text-xs text-[var(--admin-on-surface-variant)]">
                      Aucune photo d'inspection disponible
                    </div>
                  )}
                </div>
              </div>
            )}

            {panelTab === 'ai' && (
              <div className="space-y-6">
                <div className="flex items-center gap-6 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <div className="relative w-16 h-16 flex items-center justify-center bg-white rounded-full border-4 border-emerald-500 font-bold text-sm text-[var(--admin-primary)] shadow-sm shrink-0">
                    {selectedInspection.aiPreScreenScore !== null
                      ? Math.round(selectedInspection.aiPreScreenScore * 10) + '%'
                      : '—'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--admin-primary)]">Score de Confiance IA</h4>
                    <p className="text-xs text-[var(--admin-on-surface-variant)] mt-0.5">
                      {selectedInspection.aiPreScreenNotes || 'Aucune note d\'analyse automatique générée.'}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700 mt-2">
                      Prix fixé : {selectedInspection.harvest?.pricePerUnit.toLocaleString('fr-FR')} FCFA / kg
                    </p>
                  </div>
                </div>

                {selectedInspection.aiPreScreenScore !== null && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[var(--admin-on-surface-variant)]">Niveau de maturité suggéré</span>
                      <span className="text-emerald-700">
                        {Math.round(selectedInspection.aiPreScreenScore)} / 10
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[var(--admin-surface-container)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${selectedInspection.aiPreScreenScore * 10}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {panelTab === 'producer' && (
              <div className="space-y-4 text-sm bg-[var(--admin-surface-container-low)] p-4 rounded-xl border border-[var(--admin-outline-variant)]/20">
                <p className="flex justify-between">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Société:</span>
                  <span className="font-bold text-[var(--admin-on-surface)]">
                    {selectedInspection.harvest?.farmerProfile?.companyName || '—'}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Producteur:</span>
                  <span className="font-bold text-[var(--admin-on-surface)]">
                    {selectedInspection.harvest?.farmerProfile?.user
                      ? `${selectedInspection.harvest.farmerProfile.user.firstName} ${selectedInspection.harvest.farmerProfile.user.lastName}`
                      : '—'}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Adresse / Origine:</span>
                  <span className="font-bold text-[var(--admin-on-surface)]">
                    {selectedInspection.harvest?.farmerProfile?.address || '—'}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Méthode de culture:</span>
                  <span className="font-bold text-[var(--admin-on-surface)]">
                    {selectedInspection.harvest?.farmingMethods || 'Traditionnelle'}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-[var(--admin-on-surface-variant)] font-medium">Statut certification:</span>
                  <span className="font-bold text-[var(--admin-primary)]">
                    {selectedInspection.harvest?.farmerProfile?.isCertified
                      ? 'Producteur Certifié'
                      : 'Non Certifié'}
                  </span>
                </p>
              </div>
            )}

            {/* Overall Notes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase">
                Observations d'inspection générale
              </label>
              <textarea
                className="w-full min-h-[80px] p-3 text-sm bg-transparent border border-[var(--admin-outline-variant)]/40 rounded-xl text-[var(--admin-on-surface)]"
                value={selectedInspection.overallNotes || ''}
                readOnly
                placeholder="Aucune observation supplémentaire..."
              />
            </div>

            {/* Actions Display */}
            <div className="pt-4 flex flex-col gap-3">
              <div className="text-center py-3 bg-[var(--admin-surface-container-low)] text-[var(--admin-on-surface-variant)] rounded-xl text-sm font-semibold border">
                Statut du rapport: <span className="uppercase font-bold text-[var(--admin-primary)]">{selectedInspection.status}</span>
              </div>
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
