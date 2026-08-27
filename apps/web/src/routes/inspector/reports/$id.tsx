import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyReportsQuery,
  createReportMutation,
  updateReportMutation,
  addReportPhotoMutation,
  removeReportPhotoMutation,
  aiScreenMutation,
  submitReportMutation,
} from '@/features/inspector/api/reports.queries';
import { usePendingHarvests } from '@/features/inspector/api/harvests.queries';
import {
  InspectionChecklistItem,
  InspectionChecklist,
  InspectionStatus,
} from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/inspector/reports/$id')({
  component: InspectionReportFormPage,
});

const DEFAULT_CHECKLIST: InspectionChecklist = {
  [InspectionChecklistItem.VISUAL_QUALITY]: { passed: true, notes: 'Aspect visuel conforme et frais' },
  [InspectionChecklistItem.MICROBIAL_COUNT]: { passed: true, notes: 'Aucune trace de moisissure ou contamination' },
  [InspectionChecklistItem.WEIGHT_CALIBRATION]: { passed: true, notes: 'Poids et calibre conformes aux spécifications' },
  [InspectionChecklistItem.PACKAGING]: { passed: true, notes: 'Conditionnement adapté au transport' },
  [InspectionChecklistItem.LABELING]: { passed: true, notes: 'Étiquetage et traçabilité vérifiés' },
};

const CHECKLIST_LABELS: Record<InspectionChecklistItem, { title: string; subtitle: string; icon: string }> = {
  [InspectionChecklistItem.VISUAL_QUALITY]: {
    title: 'Qualité visuelle & Fraîcheur',
    subtitle: 'Couleur, maturité, absence de flétrissement',
    icon: 'visibility',
  },
  [InspectionChecklistItem.MICROBIAL_COUNT]: {
    title: 'Conformité sanitaire',
    subtitle: 'Absence de pourriture, parasites ou champignons',
    icon: 'health_and_safety',
  },
  [InspectionChecklistItem.WEIGHT_CALIBRATION]: {
    title: 'Calibrage & Pesée',
    subtitle: 'Homogénéité de taille et poids conforme',
    icon: 'scale',
  },
  [InspectionChecklistItem.PACKAGING]: {
    title: 'Conditionnement',
    subtitle: 'Caisses ou sacs propres et aérés',
    icon: 'inventory_2',
  },
  [InspectionChecklistItem.LABELING]: {
    title: 'Étiquetage & Traçabilité',
    subtitle: 'Origine parcelle et numéro de lot',
    icon: 'qr_code_2',
  },
};

function InspectionReportFormPage() {
  const { id: harvestId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allHarvests = [] } = usePendingHarvests();
  const harvest = useMemo(() => allHarvests.find((h) => h.id === harvestId), [allHarvests, harvestId]);

  const { data: myReports = [], isLoading: reportsLoading, refetch: refetchReports } = useQuery(getMyReportsQuery());

  // Existing report for this harvest
  const existingReport = useMemo(
    () => myReports.find((r) => r.harvestId === harvestId && r.status === InspectionStatus.IN_PROGRESS),
    [myReports, harvestId]
  );

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<InspectionChecklist>(DEFAULT_CHECKLIST);
  const [overallNotes, setOverallNotes] = useState('');
  const [finalQualityScore, setFinalQualityScore] = useState<number>(8.5);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Mutations
  const createReport = useMutation({
    ...createReportMutation(),
    onSuccess: (data) => {
      setActiveReportId(data.id);
      void refetchReports();
    },
  });

  const updateReport = useMutation({
    ...updateReportMutation(),
    onSuccess: () => {
      addToast('Brouillon sauvegardé', 'info');
      void refetchReports();
    },
  });

  const addPhoto = useMutation({
    ...addReportPhotoMutation(),
    onSuccess: () => {
      addToast('Photo ajoutée au dossier', 'success');
      setPhotoUrlInput('');
      void refetchReports();
    },
    onError: () => addToast("Erreur lors de l'ajout de la photo", 'error'),
  });

  const removePhoto = useMutation({
    ...removeReportPhotoMutation(),
    onSuccess: () => {
      addToast('Photo retirée', 'info');
      void refetchReports();
    },
  });

  const aiScreen = useMutation({
    ...aiScreenMutation(),
    onSuccess: (data) => {
      addToast('Analyse IA terminée avec succès !', 'success');
      if (data.aiPreScreenScore != null) {
        setFinalQualityScore(Number(data.aiPreScreenScore));
      }
      void refetchReports();
    },
    onError: () => addToast("Erreur lors de l'analyse IA", 'error'),
  });

  const submitReport = useMutation({
    ...submitReportMutation(),
    onSuccess: () => {
      addToast('Rapport validé et certifié avec succès !', 'success');
      queryClient.invalidateQueries({ queryKey: ['inspector'] });
      void navigate({ to: '/inspector/validate' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la soumission';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  // Sync state when report is found or auto-create one
  useEffect(() => {
    if (existingReport) {
      setActiveReportId(existingReport.id);
      if (existingReport.checklist) {
        setChecklist({ ...DEFAULT_CHECKLIST, ...existingReport.checklist });
      }
      if (existingReport.overallNotes) {
        setOverallNotes(existingReport.overallNotes);
      }
      if (existingReport.finalQualityScore != null) {
        setFinalQualityScore(Number(existingReport.finalQualityScore));
      }
    } else if (!reportsLoading && !activeReportId && harvestId) {
      // Auto-create in-progress report
      createReport.mutate({
        harvestId,
        siteVisitDate: new Date().toISOString().split('T')[0] || '2026-06-20',
        checklist: DEFAULT_CHECKLIST,
      });
    }
  }, [existingReport, reportsLoading, harvestId]);

  const handleToggleChecklist = (key: InspectionChecklistItem) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        passed: !prev[key].passed,
      },
    }));
  };

  const handleChecklistNotes = (key: InspectionChecklistItem, notes: string) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        notes,
      },
    }));
  };

  const handleSaveDraft = useCallback(() => {
    if (!activeReportId) return;
    updateReport.mutate({
      id: activeReportId,
      dto: {
        checklist,
        overallNotes,
      },
    });
  }, [activeReportId, checklist, overallNotes]);

  const handleAddPhotoUrl = () => {
    if (!activeReportId || !photoUrlInput.trim()) return;
    addPhoto.mutate({
      id: activeReportId,
      dto: {
        url: photoUrlInput.trim(),
        takenAt: new Date().toISOString(),
        latitude: 5.359951,
        longitude: -3.981409,
      },
    });
  };

  const handleTriggerAiScreen = () => {
    if (!activeReportId) return;
    aiScreen.mutate(activeReportId);
  };

  const handleSubmitFinal = () => {
    if (!activeReportId) return;
    submitReport.mutate({
      id: activeReportId,
      dto: {
        finalQualityScore: Number(finalQualityScore),
        overallNotes,
        checklist,
      },
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9ff]">
      {/* Top App Bar */}
      <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Link to="/inspector/validate" className="p-1 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-[#0b1c30]">Rapport d'Inspection</h1>
            <p className="text-[10px] text-gray-500 truncate max-w-[200px]">
              {harvest ? `${harvest.productName} • ${harvest.producerName}` : `Lot #${harvestId.slice(0, 6)}`}
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveDraft}
          disabled={updateReport.isPending || !activeReportId}
          className="text-xs text-[#1a5c35] font-bold px-3 py-1.5 rounded-lg border border-[#1a5c35]/30 hover:bg-[#1a5c35]/10 active:scale-95 transition-all cursor-pointer"
        >
          {updateReport.isPending ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </header>

      {/* Main Form */}
      <main className="p-4 space-y-4 flex-1 pb-24">
        {/* Harvest Summary Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#1a5c35] bg-[#1a5c35]/10 px-2 py-0.5 rounded-full">
                Lot en cours d'audit
              </span>
              <h2 className="text-base font-bold text-[#0b1c30] mt-1">
                {harvest?.productName || 'Produit Agricole'}
              </h2>
              <p className="text-xs text-gray-600">Producteur : {harvest?.producerName || 'Producteur local'}</p>
            </div>
            {harvest && (
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-gray-900">
                  {harvest.quantity} {harvest.unit}
                </span>
                <p className="text-[10px] text-gray-500">Stock déclaré</p>
              </div>
            )}
          </div>
        </div>

        {/* Inspection Checklist */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">Grille de conformité qualité</h3>
            <p className="text-xs text-gray-500">Cochez les critères validés et ajoutez vos remarques.</p>
          </div>

          <div className="space-y-3">
            {(Object.keys(CHECKLIST_LABELS) as InspectionChecklistItem[]).map((key) => {
              const meta = CHECKLIST_LABELS[key];
              const item = checklist[key] || { passed: true, notes: '' };

              return (
                <div
                  key={key}
                  className={`p-3 rounded-xl border transition-all ${
                    item.passed
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-rose-200 bg-rose-50/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`material-symbols-outlined text-lg p-1.5 rounded-lg ${
                          item.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900">{meta.title}</h4>
                        <p className="text-[10px] text-gray-500 truncate">{meta.subtitle}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleChecklist(key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        item.passed
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-rose-600 text-white shadow-xs'
                      }`}
                    >
                      {item.passed ? 'Conforme' : 'Non-conforme'}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => handleChecklistNotes(key, e.target.value)}
                    placeholder="Remarques spécifiques sur ce critère..."
                    className="w-full mt-2 text-xs border border-gray-200 rounded-lg p-2 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1a5c35]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Inspection Photos & GPS Traceability */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">Photos d'inspection terrain</h3>
            <p className="text-xs text-gray-500">Ajoutez des photos horodatées pour la traçabilité.</p>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={photoUrlInput}
              onChange={(e) => setPhotoUrlInput(e.target.value)}
              placeholder="https://... URL de photo d'inspection"
              className="flex-1 text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
            />
            <button
              onClick={handleAddPhotoUrl}
              disabled={!photoUrlInput.trim() || addPhoto.isPending}
              className="px-4 py-2.5 bg-[#1a5c35] text-white text-xs font-bold rounded-xl hover:bg-[#144a2a] disabled:opacity-50 cursor-pointer"
            >
              Ajouter
            </button>
          </div>

          {/* Photos list */}
          {existingReport?.photos && existingReport.photos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {existingReport.photos.map((photo) => (
                <div key={photo.id} className="relative rounded-xl overflow-hidden border border-gray-200 group">
                  <img src={photo.url} alt="Inspection" className="h-28 w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => activeReportId && removePhoto.mutate({ id: activeReportId, photoId: photo.id })}
                      className="p-1.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                  <span className="absolute bottom-1 left-1 text-[9px] font-mono text-white bg-black/60 px-1 py-0.5 rounded">
                    GPS: 5.35°N, 3.98°W
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Vision Pre-Screening */}
        <div className="bg-gradient-to-br from-emerald-900 to-[#1a5c35] text-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-emerald-300">smart_toy</span>
              <h3 className="text-sm font-bold">Assistance IA Vision (Gemini 2.5)</h3>
            </div>
            <span className="text-[10px] bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full font-bold">
              Pré-analyse
            </span>
          </div>

          <p className="text-xs text-emerald-100 leading-relaxed">
            L'IA analyse les photos du lot pour détecter les défauts et estimer un score de calibrage initial.
          </p>

          {existingReport?.aiPreScreenScore != null ? (
            <div className="bg-white/10 rounded-xl p-3 border border-white/15 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-200">Score IA estimé</span>
                <span className="font-mono text-base font-bold text-white">
                  {Number(existingReport.aiPreScreenScore).toFixed(1)} / 10.0
                </span>
              </div>
              {existingReport.aiPreScreenNotes && (
                <p className="text-xs text-emerald-100 italic pt-1 border-t border-white/10">
                  {existingReport.aiPreScreenNotes}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleTriggerAiScreen}
              disabled={aiScreen.isPending || !activeReportId}
              className="w-full py-2.5 bg-white text-[#1a5c35] font-bold rounded-xl text-xs shadow-sm hover:bg-emerald-50 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              {aiScreen.isPending ? "Analyse en cours par Gemini..." : "Lancer le pré-screening IA"}
            </button>
          )}
        </div>

        {/* Final Quality Score Assignment */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Score de Qualité Final</h3>
              <p className="text-xs text-gray-500">Attribuez la note officielle finale certifiée.</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-bold text-[#1a5c35]">
                {finalQualityScore.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500"> / 10.0</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={finalQualityScore}
            onChange={(e) => setFinalQualityScore(parseFloat(e.target.value))}
            className="w-full accent-[#1a5c35] cursor-pointer"
          />

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Conclusion générale de l'inspecteur</label>
            <textarea
              rows={3}
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder="Rédigez ici vos observations finales pour le producteur et les acheteurs..."
              className="w-full text-xs border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
            />
          </div>
        </div>

        {/* Submit Action Button */}
        <div className="pt-2">
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={submitReport.isPending || !activeReportId}
            className="w-full py-3.5 bg-[#1a5c35] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#144a2a] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">verified</span>
            Valider & Certifier le lot
          </button>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl animate-slide-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#1a5c35] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-gray-900">Confirmer la certification</h3>
              <p className="text-xs text-gray-500">
                Vous vous apprêtez à certifier ce lot avec une note de{' '}
                <span className="font-bold text-gray-900">{finalQualityScore.toFixed(1)}/10</span>. Le lot sera
                immédiatement visible pour les acheteurs sur le marché.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  handleSubmitFinal();
                }}
                disabled={submitReport.isPending}
                className="flex-1 py-2.5 bg-[#1a5c35] text-white rounded-xl text-xs font-bold hover:bg-[#144a2a] cursor-pointer"
              >
                {submitReport.isPending ? 'Certification...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
