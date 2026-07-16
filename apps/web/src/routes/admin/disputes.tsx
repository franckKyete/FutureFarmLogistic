import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, Dispute, DisputeStatus, DisputeSeverity } from '@futurefarm/types';
import { useDisputes, useResolveDispute } from '@/features/admin/api/disputes.queries';
import {
  StatCard,
  Button,
  AdminTable,
  TableFilters,
  AdminTabs,
  SidePanel,
} from '@/features/admin/components';

export const Route = createFileRoute('/admin/disputes')({
  beforeLoad: () => {
    requireAuth(Permission.DISPUTE_READ);
  },
  component: DisputesPage,
});

interface DisputeWithRelations extends Dispute {
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

function DisputesPage() {
  const { data: disputesData = [], isLoading, isError, refetch } = useDisputes();
  const disputes = disputesData as DisputeWithRelations[];
  const resolveDisputeMutation = useResolveDispute();

  const [activeTab, setActiveTab] = useState('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [litigeType, setLitigeType] = useState('all');
  const [urgency, setUrgency] = useState<'all' | 'high' | 'normal'>('all');

  const [selectedDispute, setSelectedDispute] = useState<DisputeWithRelations | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'file' | 'versions' | 'decision'>('file');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Filtering based on tab:
  // 'open' tab -> DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW
  // 'resolved' tab -> DisputeStatus.RESOLVED, DisputeStatus.DISMISSED
  const tabFilteredDisputes = disputes.filter((d) => {
    if (activeTab === 'open') {
      return d.status === DisputeStatus.OPEN || d.status === DisputeStatus.UNDER_REVIEW;
    } else {
      return d.status === DisputeStatus.RESOLVED || d.status === DisputeStatus.DISMISSED;
    }
  });

  const filteredDisputes = tabFilteredDisputes.filter((d) => {
    const creatorName = d.createdBy ? `${d.createdBy.firstName} ${d.createdBy.lastName}` : '';
    const matchesSearch =
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creatorName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = litigeType === 'all' || d.relatedType === litigeType;
    
    const isUrgent = d.severity === DisputeSeverity.HIGH || d.severity === DisputeSeverity.CRITICAL;
    const matchesUrgency =
      urgency === 'all' ||
      (urgency === 'high' && isUrgent) ||
      (urgency === 'normal' && !isUrgent);

    return matchesSearch && matchesType && matchesUrgency;
  });

  // KPI Calculations
  const openCount = disputes.filter(
    (d) => d.status === DisputeStatus.OPEN || d.status === DisputeStatus.UNDER_REVIEW
  ).length;
  const underReviewCount = disputes.filter((d) => d.status === DisputeStatus.UNDER_REVIEW).length;
  const resolvedCount = disputes.filter(
    (d) => d.status === DisputeStatus.RESOLVED || d.status === DisputeStatus.DISMISSED
  ).length;

  // Average open days calculation
  let avgDaysStr = '—';
  const openDisputesList = disputes.filter(
    (d) => d.status === DisputeStatus.OPEN || d.status === DisputeStatus.UNDER_REVIEW
  );
  if (openDisputesList.length > 0) {
    const totalDays = openDisputesList.reduce((acc, curr) => {
      const days = (Date.now() - new Date(curr.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return acc + Math.max(0, days);
    }, 0);
    avgDaysStr = (totalDays / openDisputesList.length).toFixed(1) + ' j';
  }

  const handleResolve = (status: DisputeStatus.RESOLVED | DisputeStatus.DISMISSED) => {
    if (!selectedDispute) return;
    resolveDisputeMutation.mutate(
      {
        id: selectedDispute.id,
        status,
        resolutionNotes,
      },
      {
        onSuccess: () => {
          setIsPanelOpen(false);
          setSelectedDispute(null);
          setResolutionNotes('');
        },
      }
    );
  };

  const columns = [
    {
      key: 'litigeNo',
      header: 'No. Litige',
      render: (row: DisputeWithRelations) => (
        <span className="font-mono font-bold text-red-600">#LIT-{row.id.slice(0, 8).toUpperCase()}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: DisputeWithRelations) => {
        const typeMap: Record<string, string> = {
          order: 'Commande',
          inspection: 'Inspection',
          delivery: 'Livraison',
        };
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            {typeMap[row.relatedType] || row.relatedType}
          </span>
        );
      },
    },
    {
      key: 'parties',
      header: 'Créé par',
      render: (row: DisputeWithRelations) => (
        <span className="text-xs font-semibold text-[var(--admin-on-surface)]">
          {row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : 'Système'}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Objet & ID Associé',
      render: (row: DisputeWithRelations) => (
        <div>
          <p className="text-xs font-semibold text-[var(--admin-on-surface)] truncate max-w-[200px]" title={row.title}>
            {row.title}
          </p>
          <p className="text-[10px] font-mono text-[var(--admin-on-surface-variant)]">
            #{row.relatedId.slice(0, 8).toUpperCase()} ({row.relatedType})
          </p>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Ouvert Depuis',
      render: (row: DisputeWithRelations) => {
        const days = Math.max(1, Math.floor((Date.now() - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
        const isUrgent = row.severity === DisputeSeverity.HIGH || row.severity === DisputeSeverity.CRITICAL;
        return (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              isUrgent ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}
          >
            {days} jour{days > 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row: DisputeWithRelations) => {
        const statusConfig: Record<string, { label: string; color: string }> = {
          [DisputeStatus.OPEN]: { label: 'Nouveau', color: 'bg-red-500' },
          [DisputeStatus.UNDER_REVIEW]: { label: 'En cours', color: 'bg-amber-500' },
          [DisputeStatus.RESOLVED]: { label: 'Résolu', color: 'bg-emerald-500' },
          [DisputeStatus.DISMISSED]: { label: 'Classé', color: 'bg-slate-500' },
        };
        const conf = statusConfig[row.status] || { label: row.status, color: 'bg-slate-500' };
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-on-surface)]">
            <span className={`w-1.5 h-1.5 rounded-full ${conf.color}`} />
            <span>{conf.label}</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: DisputeWithRelations) => (
        <div className="flex justify-end items-center gap-1.5">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDispute(row);
              setResolutionNotes(row.resolutionNotes || '');
              setIsPanelOpen(true);
            }}
            size="sm"
            className="bg-[var(--admin-primary)] text-white text-[11px] px-3 py-1 font-semibold"
          >
            Traiter
          </Button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDispute(row);
              setResolutionNotes(row.resolutionNotes || '');
              setIsPanelOpen(true);
            }}
            className="p-1.5 hover:bg-[var(--admin-surface-container-high)] rounded-lg text-[var(--admin-on-surface-variant)] transition-all"
          >
            <span className="material-symbols-outlined text-lg">visibility</span>
          </button>
        </div>
      ),
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
          Impossible de récupérer les litiges depuis le serveur
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
      <div className="flex justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
            Gestion des litiges
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
            Suivez et résolvez les litiges liés aux commandes, inspections et livraisons.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon="warning" value={openCount} label="Litiges ouverts" iconBgColor="bg-red-50" iconColor="text-red-700" />
        <StatCard icon="pending_actions" value={underReviewCount} label="En cours" iconBgColor="bg-amber-50" iconColor="text-amber-700" />
        <StatCard icon="task_alt" value={resolvedCount} label="Résolus" iconBgColor="bg-emerald-50" iconColor="text-emerald-700" />
        <StatCard icon="schedule" value={avgDaysStr} label="Délai moyen ouvert" iconBgColor="bg-blue-50" iconColor="text-blue-700" />
      </div>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { id: 'open', label: 'Litiges ouverts', count: openCount },
          { id: 'resolved', label: 'Litiges résolus', count: resolvedCount },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Filters */}
      <TableFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Rechercher un litige par ID, titre, créateur...">
        <select
          value={litigeType}
          onChange={(e) => setLitigeType(e.target.value)}
          className="px-4 py-2 bg-transparent border border-[var(--admin-outline-variant)]/40 rounded-lg text-sm text-[var(--admin-on-surface-variant)] focus:ring-[var(--admin-primary)]/20"
        >
          <option value="all">Tous les types</option>
          <option value="order">Commande</option>
          <option value="inspection">Inspection</option>
          <option value="delivery">Livraison</option>
        </select>

        <div className="flex bg-[var(--admin-surface-container-low)] p-1 rounded-lg border border-[var(--admin-outline-variant)]/20 gap-1">
          {(['all', 'high', 'normal'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setUrgency(opt)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                urgency === opt
                  ? 'bg-white text-[var(--admin-primary)] shadow-sm'
                  : 'text-[var(--admin-on-surface-variant)] hover:bg-white/50'
              }`}
            >
              {opt === 'all' ? 'Tous' : opt === 'high' ? 'Haute/Critique' : 'Normale/Basse'}
            </button>
          ))}
        </div>
      </TableFilters>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={filteredDisputes}
        onRowClick={(row) => {
          setSelectedDispute(row);
          setResolutionNotes(row.resolutionNotes || '');
          setIsPanelOpen(true);
        }}
      />

      {/* Slide-out disputes detail panel */}
      <SidePanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        title={selectedDispute ? `#LIT-${selectedDispute.id.slice(0, 8).toUpperCase()}` : ''}
        width="w-[500px]"
      >
        {selectedDispute && (
          <div className="flex flex-col h-full bg-[var(--admin-surface-container-lowest)] p-6 space-y-6">
            <div className="pb-3 border-b border-[var(--admin-outline-variant)]/30 flex gap-4">
              {(['file', 'versions', 'decision'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPanelTab(tab)}
                  className={`text-sm font-semibold capitalize transition-all ${
                    panelTab === tab
                      ? 'text-[var(--admin-primary)] border-b-2 border-[var(--admin-primary)] pb-1'
                      : 'text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]'
                  }`}
                >
                  {tab === 'file' ? 'Dossier' : tab === 'versions' ? 'Versions' : 'Décision'}
                </button>
              ))}
            </div>

            {panelTab === 'file' && (
              <div className="space-y-6">
                <div className="bg-[var(--admin-surface-container-low)] p-4 rounded-xl border border-[var(--admin-outline-variant)]/20 space-y-2">
                  <h4 className="text-[10px] font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                    Informations Commande / Source
                  </h4>
                  <p className="font-bold text-sm text-[var(--admin-on-surface)]">
                    Type: <span className="capitalize">{selectedDispute.relatedType}</span>
                  </p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    ID Associé: #{selectedDispute.relatedId}
                  </p>
                  <div className="flex justify-between text-xs text-[var(--admin-on-surface-variant)] pt-1">
                    <span>Créé le: {new Date(selectedDispute.createdAt).toLocaleDateString('fr-FR')}</span>
                    <span className="font-bold text-red-600">Gravité: {selectedDispute.severity}</span>
                  </div>
                </div>

                <div className="bg-[var(--admin-surface-container-low)] p-4 rounded-xl border border-[var(--admin-outline-variant)]/20 space-y-2">
                  <h4 className="text-[10px] font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                    Description du Litige
                  </h4>
                  <p className="font-bold text-sm text-[var(--admin-on-surface)]">{selectedDispute.title}</p>
                  <p className="text-xs text-[var(--admin-on-surface-variant)] whitespace-pre-wrap">
                    {selectedDispute.description}
                  </p>
                </div>

                {selectedDispute.resolutionNotes && (
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-2">
                    <h4 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Notes de Résolution
                    </h4>
                    <p className="text-xs text-emerald-700 whitespace-pre-wrap">
                      {selectedDispute.resolutionNotes}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase">Documents joints</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border border-[var(--admin-outline-variant)]/40 hover:border-[var(--admin-primary)] rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-slate-50">
                      <span className="material-symbols-outlined text-red-600 text-lg">picture_as_pdf</span>
                      <span className="text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">Contrat</span>
                    </div>
                    <div className="border border-[var(--admin-outline-variant)]/40 hover:border-[var(--admin-primary)] rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-slate-50">
                      <span className="material-symbols-outlined text-blue-600 text-lg">image</span>
                      <span className="text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">Photo Lot</span>
                    </div>
                    <div className="border border-[var(--admin-outline-variant)]/40 hover:border-[var(--admin-primary)] rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-slate-50">
                      <span className="material-symbols-outlined text-slate-600 text-lg">receipt</span>
                      <span className="text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">Facture</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {panelTab === 'versions' && (
              <div className="space-y-4 text-xs text-[var(--admin-on-surface-variant)] bg-[var(--admin-surface-container-low)] p-4 rounded-xl">
                <p>Historique des révisions du litige.</p>
                <div className="space-y-2">
                  <div className="flex justify-between border-b pb-1">
                    <span>Création du dossier</span>
                    <span>{new Date(selectedDispute.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dernière mise à jour</span>
                    <span>{new Date(selectedDispute.updatedAt).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>
            )}

            {panelTab === 'decision' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase mb-1">
                    Notes de décision administrative
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="w-full min-h-[100px] p-3 text-sm border border-[var(--admin-outline-variant)]/40 rounded-xl bg-transparent text-[var(--admin-on-surface)]"
                    placeholder="Saisissez les notes de résolution du litige..."
                    disabled={selectedDispute.status === DisputeStatus.RESOLVED || selectedDispute.status === DisputeStatus.DISMISSED}
                  />
                </div>
                {selectedDispute.status !== DisputeStatus.RESOLVED && selectedDispute.status !== DisputeStatus.DISMISSED ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleResolve(DisputeStatus.RESOLVED)}
                      className="flex-1 bg-[var(--admin-primary)] text-white hover:brightness-110"
                      disabled={resolveDisputeMutation.isPending}
                    >
                      {resolveDisputeMutation.isPending ? 'En cours...' : 'Résoudre le litige'}
                    </Button>
                    <Button
                      onClick={() => handleResolve(DisputeStatus.DISMISSED)}
                      variant="secondary"
                      className="flex-1 border border-[var(--admin-outline-variant)]/40 hover:bg-[var(--admin-surface-container-low)]"
                      disabled={resolveDisputeMutation.isPending}
                    >
                      Classer sans suite
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-semibold">
                    Ce litige est clos ({selectedDispute.status})
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}
