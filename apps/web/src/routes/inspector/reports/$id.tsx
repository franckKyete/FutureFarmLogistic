import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  getMyReportsQuery,
  createReportMutation,
  updateReportMutation,
  addReportPhotoMutation,
  removeReportPhotoMutation,
  aiScreenMutation,
  submitReportMutation,
} from '@/features/inspector/api/reports.queries';
import {
  usePendingHarvests,
  useVerifyHarvest,
} from '@/features/inspector/api/harvests.queries';
import { mediaUploadMutation } from '@/features/harvests/api/harvests.queries';
import {
  useVisits,
  useCreateVisit,
  useUpdateVisit,
} from '@/features/inspector/api/visits.queries';
import {
  InspectionChecklistItem,
  InspectionChecklist,
  InspectionStatus,
  VisitReason,
  HarvestUnit,
} from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/inspector/reports/$id')({
  component: InspectionReportFormPage,
});

const DEFAULT_CHECKLIST: InspectionChecklist = {
  [InspectionChecklistItem.VISUAL_QUALITY]: {
    passed: true,
    notes: 'Aspect visuel conforme et frais',
  },
  [InspectionChecklistItem.MICROBIAL_COUNT]: {
    passed: true,
    notes: 'Aucune trace de moisissure ou contamination',
  },
  [InspectionChecklistItem.WEIGHT_CALIBRATION]: {
    passed: true,
    notes: 'Poids et calibre conformes aux spécifications',
  },
  [InspectionChecklistItem.PACKAGING]: {
    passed: true,
    notes: 'Conditionnement adapté au transport',
  },
};

const CHECKLIST_LABELS: Record<
  Exclude<InspectionChecklistItem, InspectionChecklistItem.LABELING>,
  { title: string; subtitle: string; icon: string }
> = {
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
};

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function InspectionReportFormPage() {
  const { id: harvestId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: allHarvests = [] } = usePendingHarvests();
  const harvest = useMemo(
    () => allHarvests.find((h) => h.id === harvestId),
    [allHarvests, harvestId],
  );

  const {
    data: myReports = [],
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = useQuery(getMyReportsQuery());

  // Existing report for this harvest
  const existingReport = useMemo(
    () => myReports.find((r) => r.harvestId === harvestId),
    [myReports, harvestId],
  );

  const isCertified =
    existingReport?.status === InspectionStatus.SUBMITTED ||
    harvest?.status === 'APPROVED';

  const isFlaggedPhysical = harvest?.status === 'FLAGGED_PHYSICAL';

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [checklist, setChecklist] =
    useState<InspectionChecklist>(DEFAULT_CHECKLIST);
  const [overallNotes, setOverallNotes] = useState('');
  const [finalQualityScore, setFinalQualityScore] = useState<number>(8.5);

  // Modals state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showManualInspectionModal, setShowManualInspectionModal] = useState(false);
  const [isProcessingManualInspection, setIsProcessingManualInspection] = useState(false);

  // Image Zoom / Lightbox state
  const [zoomedImageIndex, setZoomedImageIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Input refs for manual inspection photo capture
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Scheduling state
  const [visitDate, setVisitDate] = useState(getTodayString());
  const [visitTime, setVisitTime] = useState('09:00');
  const [visitNotes, setVisitNotes] = useState('');
  const [dismissCapacityWarning, setDismissCapacityWarning] = useState(false);

  // Reschedule state
  const [rescheduleDate, setRescheduleDate] = useState(getTodayString());
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // Physical Inspection Harvest Edit State
  const [editQuantity, setEditQuantity] = useState<number | ''>('');
  const [editStockMarge, setEditStockMarge] = useState<number | ''>(0);
  const [editPricePerUnit, setEditPricePerUnit] = useState<number | ''>('');
  const [editUnit, setEditUnit] = useState<HarvestUnit>(HarvestUnit.KG);
  const [editFarmingMethods, setEditFarmingMethods] = useState('');
  const [isHarvestDetailsOpen, setIsHarvestDetailsOpen] = useState(true);

  // Rejection state
  const [rejectionReason, setRejectionReason] = useState('');

  // Query visits to find linked visit
  const { data: allVisits = [] } = useVisits();
  const linkedVisit = useMemo(
    () =>
      allVisits.find(
        (v) =>
          v.harvestId === harvestId ||
          (v.status === 'PLANNED' &&
            (v.producerId === harvest?.farmerUserId ||
              v.producerId === (harvest as any)?.farmerProfileId ||
              v.producerId === harvest?.id)),
      ),
    [allVisits, harvestId, harvest],
  );

  // Sync harvest edit fields when harvest data loads
  useEffect(() => {
    if (harvest) {
      setEditQuantity(harvest.quantity != null ? Number(harvest.quantity) : '');
      setEditStockMarge(harvest.stockMarge != null ? Number(harvest.stockMarge) : 0);
      setEditPricePerUnit(harvest.pricePerUnit != null ? Number(harvest.pricePerUnit) : '');
      setEditUnit((harvest.unit as HarvestUnit) ?? HarvestUnit.KG);
      setEditFarmingMethods(harvest.farmingMethods ?? '');
    }
  }, [harvest]);

  // Sync reschedule modal state when linkedVisit is found
  useEffect(() => {
    if (linkedVisit) {
      if (linkedVisit.plannedDate) setRescheduleDate(linkedVisit.plannedDate.split('T')[0] ?? '');
      if (linkedVisit.plannedTime) setRescheduleTime(linkedVisit.plannedTime);
      if (linkedVisit.notes) setRescheduleNotes(linkedVisit.notes);
    }
  }, [linkedVisit]);

  // Capacity check for scheduled visit date
  const { data: dayVisits = [] } = useVisits({ date: visitDate });
  const isOverCapacity = dayVisits.length >= 3;

  // Mutations
  const verifyHarvestMutation = useVerifyHarvest();
  const createVisitMutation = useCreateVisit();
  const updateVisitMutation = useUpdateVisit();

  const updateHarvestMutation = useMutation({
    mutationFn: async (payload: any) => {
      const farmerUserId =
        harvest?.farmerUserId ||
        (harvest as any)?.farmerProfileId ||
        harvest?.id;
      const { data } = await apiClient.patch(`/harvests/${harvestId}/proxy`, {
        ...payload,
        farmerUserId,
      });
      return data.data;
    },
    onSuccess: () => {
      addToast('Données du lot mises à jour avec succès !', 'success');
      queryClient.invalidateQueries({ queryKey: ['inspector'] });
      queryClient.invalidateQueries({ queryKey: ['harvests'] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || 'Erreur lors de la mise à jour';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

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

  const uploadMedia = useMutation(mediaUploadMutation());

  const addPhoto = useMutation({
    ...addReportPhotoMutation(),
    onSuccess: () => {
      addToast('Photo ajoutée au dossier d\'inspection', 'success');
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
      const msg =
        err?.response?.data?.message || 'Erreur lors de la soumission';
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
      } else if (existingReport.aiPreScreenScore != null) {
        setFinalQualityScore(Number(existingReport.aiPreScreenScore));
      } else if (harvest?.qualityScore != null) {
        setFinalQualityScore(Number(harvest.qualityScore));
      }
    } else if (harvest?.qualityScore != null) {
      setFinalQualityScore(Number(harvest.qualityScore));
    }
    if (!existingReport && !reportsLoading && !activeReportId && harvestId && !isCertified) {
      // Auto-create in-progress report only if not already certified
      createReport.mutate({
        harvestId,
        siteVisitDate: new Date().toISOString().split('T')[0] || '2026-06-20',
        checklist: DEFAULT_CHECKLIST,
      });
    }
  }, [existingReport, reportsLoading, harvestId, isCertified, harvest]);

  const handleToggleChecklist = (key: InspectionChecklistItem) => {
    if (isCertified) return;
    setChecklist((prev) => {
      const current = prev[key] || { passed: true, notes: '' };
      return {
        ...prev,
        [key]: {
          ...current,
          passed: !current.passed,
        },
      };
    });
  };

  const handleChecklistNotes = (
    key: InspectionChecklistItem,
    notes: string,
  ) => {
    if (isCertified) return;
    setChecklist((prev) => {
      const current = prev[key] || { passed: true, notes: '' };
      return {
        ...prev,
        [key]: {
          ...current,
          notes,
        },
      };
    });
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
  }, [activeReportId, checklist, overallNotes, updateReport]);

  // Combined list of photos for inspection and zoom
  const allPhotos = useMemo(() => {
    const reportPhotos = (existingReport?.photos || []).map((p) => ({
      id: p.id,
      url: p.url,
      isReportPhoto: true,
      takenAt: p.takenAt,
    }));
    const harvestPhotos = (harvest?.images || []).map((url, i) => ({
      id: `harvest-photo-${i}`,
      url,
      isReportPhoto: false,
      takenAt: undefined,
    }));
    return reportPhotos.length > 0 ? reportPhotos : harvestPhotos;
  }, [existingReport?.photos, harvest?.images]);

  // Keyboard navigation for image zoom lightbox
  useEffect(() => {
    if (zoomedImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedImageIndex(null);
        setZoomLevel(1);
      } else if (e.key === 'ArrowRight') {
        setZoomedImageIndex((prev) =>
          prev !== null ? (prev + 1) % allPhotos.length : null,
        );
        setZoomLevel(1);
      } else if (e.key === 'ArrowLeft') {
        setZoomedImageIndex((prev) =>
          prev !== null
            ? (prev - 1 + allPhotos.length) % allPhotos.length
            : null,
        );
        setZoomLevel(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedImageIndex, allPhotos.length]);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!activeReportId) {
      addToast('Rapport non disponible', 'error');
      return;
    }
    const filesArray = Array.from(files);
    for (const file of filesArray) {
      try {
        const res = await uploadMedia.mutateAsync(file);
        await addPhoto.mutateAsync({
          id: activeReportId,
          dto: {
            url: res.url,
            takenAt: new Date().toISOString(),
            latitude: 5.359951,
            longitude: -3.981409,
          },
        });
      } catch {
        addToast("Erreur lors de l'envoi de la photo", 'error');
      }
    }
  };

  const handleRunManualInspectionAnalysis = async () => {
    if (!activeReportId) {
      addToast('Rapport non disponible pour analyse.', 'error');
      return;
    }
    setIsProcessingManualInspection(true);
    try {
      const updatedReport = await aiScreen.mutateAsync(activeReportId);
      if (updatedReport.aiPreScreenScore != null) {
        setFinalQualityScore(Number(updatedReport.aiPreScreenScore));
      }
      setShowManualInspectionModal(false);
      addToast('Inspection manuelle et analyse IA terminées avec succès !', 'success');
      void refetchReports();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Erreur lors de l'analyse IA";
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    } finally {
      setIsProcessingManualInspection(false);
    }
  };

  // Action 1: Approve & Certify
  const handleSubmitApprove = () => {
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

  // Action 2: Schedule Physical Inspection
  const handleConfirmScheduleVisit = async () => {
    try {
      await verifyHarvestMutation.mutateAsync({
        id: harvestId,
        status: 'FLAGGED_PHYSICAL',
        qualityScore: Number(finalQualityScore),
        rejectionReason:
          visitNotes.trim() || 'Visite physique sur parcelle requise.',
      });

      // Also create visit entry if producer info is available
      const targetProducerId =
        harvest?.farmerUserId || (harvest as any)?.farmerProfileId || harvest?.id;
      if (targetProducerId) {
        try {
          await createVisitMutation.mutateAsync({
            producerId: targetProducerId,
            plannedDate: visitDate,
            plannedTime: visitTime,
            reason: VisitReason.URGENT,
            notes: visitNotes || `Audit terrain pour lot #${harvestId.slice(0, 6)}`,
            harvestId,
          });
        } catch (visitErr) {
          console.error('Failed to create visit record:', visitErr);
        }
      }

      addToast('Lot marqué pour visite d\'inspection physique !', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspector'] }),
        queryClient.invalidateQueries({ queryKey: ['inspector', 'visits'] }),
        queryClient.invalidateQueries({ queryKey: ['inspector', 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['inspector', 'harvests'] }),
      ]);
      setShowScheduleModal(false);
      void navigate({ to: '/inspector/validate' });
    } catch {
      addToast('Erreur lors de la programmation de la visite', 'error');
    }
  };

  // Action 2b: Reschedule Physical Inspection
  const handleConfirmRescheduleVisit = async () => {
    try {
      if (linkedVisit?.id) {
        const updatePayload: { id: string; plannedDate?: string; plannedTime?: string; notes?: string } = {
          id: linkedVisit.id,
          plannedDate: rescheduleDate,
          plannedTime: rescheduleTime,
        };
        const resolvedNotes = rescheduleNotes || linkedVisit.notes;
        if (resolvedNotes) {
          updatePayload.notes = resolvedNotes;
        }
        await updateVisitMutation.mutateAsync(updatePayload);
      } else {
        const targetProducerId =
          harvest?.farmerUserId || (harvest as any)?.farmerProfileId || harvest?.id;
        if (targetProducerId) {
          await createVisitMutation.mutateAsync({
            producerId: targetProducerId,
            plannedDate: rescheduleDate,
            plannedTime: rescheduleTime,
            reason: VisitReason.URGENT,
            notes: rescheduleNotes || `Audit terrain pour lot #${harvestId.slice(0, 6)}`,
            harvestId,
          });
        }
      }

      addToast('Visite d\'inspection reprogrammée avec succès !', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspector'] }),
        queryClient.invalidateQueries({ queryKey: ['inspector', 'visits'] }),
        queryClient.invalidateQueries({ queryKey: ['inspector', 'dashboard'] }),
      ]);
      setShowRescheduleModal(false);
    } catch {
      addToast('Erreur lors de la reprogrammation de la visite', 'error');
    }
  };

  const handleSaveHarvestDetails = () => {
    if (!editQuantity || !editPricePerUnit) {
      addToast('Veuillez spécifier la quantité et le prix unitaire.', 'error');
      return;
    }
    updateHarvestMutation.mutate({
      quantityInStock: Number(editQuantity),
      stockMarge: Number(editStockMarge) || 0,
      pricePerUnit: Number(editPricePerUnit),
      unit: editUnit,
      farmingMethods: editFarmingMethods || undefined,
    });
  };

  // Action 3: Reject Harvest Batch
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) return;
    try {
      await verifyHarvestMutation.mutateAsync({
        id: harvestId,
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      });
      addToast('Lot rejeté avec notification au producteur', 'success');
      queryClient.invalidateQueries({ queryKey: ['inspector'] });
      setShowRejectModal(false);
      void navigate({ to: '/inspector/validate' });
    } catch {
      addToast('Erreur lors du rejet du lot', 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9ff] font-sans pb-28">
      {/* Top App Bar */}
      <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <Link
            to="/inspector/validate"
            className="p-1 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-[#0b1c30]">
              Rapport d'Inspection
            </h1>
            <p className="text-[10px] text-gray-500 truncate max-w-[200px]">
              {harvest
                ? `${harvest.productName} • ${harvest.producerName}`
                : `Lot #${harvestId.slice(0, 6)}`}
            </p>
          </div>
        </div>

        {isCertified ? (
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">verified</span>
            Certifié
          </span>
        ) : (
          <button
            onClick={handleSaveDraft}
            disabled={updateReport.isPending || !activeReportId}
            className="text-xs text-[#1a5c35] font-bold px-3 py-1.5 rounded-lg border border-[#1a5c35]/30 hover:bg-[#1a5c35]/10 active:scale-95 transition-all cursor-pointer"
          >
            {updateReport.isPending ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        )}
      </header>

      {/* Main Form */}
      <main className="p-4 space-y-4 flex-1 max-w-3xl mx-auto w-full">
        {isCertified && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 shadow-2xs">
            <span className="material-symbols-outlined text-emerald-600 text-2xl shrink-0">
              verified
            </span>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-emerald-900">
                Rapport d'inspection certifié conforme sur le terrain
              </h4>
              <p className="text-[11px] text-emerald-700">
                Cette récolte a été inspectée et certifiée avec succès (note de{' '}
                {finalQualityScore.toFixed(1)}/10). Les critères ci-dessous constituent le rapport d'audit officiel.
              </p>
            </div>
          </div>
        )}

        {/* Harvest Summary Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isCertified
                    ? 'text-emerald-800 bg-emerald-100'
                    : 'text-[#1a5c35] bg-[#1a5c35]/10'
                }`}
              >
                {isCertified ? 'Lot certifié conforme' : "Lot en cours d'audit"}
              </span>
              <h2 className="text-base font-bold text-[#0b1c30] mt-1">
                {harvest?.productName || 'Produit Agricole'}
              </h2>
              <p className="text-xs text-gray-600">
                Producteur : {harvest?.producerName || 'Producteur local'}
              </p>
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

        {/* Harvest Information Review & Update Card */}
        {!isCertified && (
          <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700">edit_note</span>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Détails & Ajustement du lot agricole
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    Consultez et ajustez si besoin les informations du lot déclaré par l'agriculteur.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHarvestDetailsOpen(!isHarvestDetailsOpen)}
                className="text-amber-800 p-1 hover:bg-amber-100 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">
                  {isHarvestDetailsOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>

            {isHarvestDetailsOpen && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Quantité physique pesée
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editQuantity}
                      onChange={(e) =>
                        setEditQuantity(
                          e.target.value === '' ? '' : parseFloat(e.target.value),
                        )
                      }
                      placeholder="Ex: 450"
                      className="w-full p-2.5 border border-amber-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Marge tolérée (± stock marge)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editStockMarge}
                      onChange={(e) =>
                        setEditStockMarge(
                          e.target.value === '' ? '' : parseFloat(e.target.value),
                        )
                      }
                      placeholder="Ex: 10"
                      className="w-full p-2.5 border border-amber-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Unité de mesure
                    </label>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value as HarvestUnit)}
                      className="w-full p-2.5 border border-amber-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                    >
                      <option value={HarvestUnit.KG}>Kilogrammes (KG)</option>
                      <option value={HarvestUnit.TON}>Tonnes (TON)</option>
                      <option value={HarvestUnit.PIECE}>Pièces (PIECE)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Prix unitaire validé (CDF / {editUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editPricePerUnit}
                      onChange={(e) =>
                        setEditPricePerUnit(
                          e.target.value === '' ? '' : parseFloat(e.target.value),
                        )
                      }
                      placeholder="Ex: 2500"
                      className="w-full p-2.5 border border-amber-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-gray-700 mb-1">
                      Méthodes de culture constatées
                    </label>
                    <input
                      type="text"
                      value={editFarmingMethods}
                      onChange={(e) => setEditFarmingMethods(e.target.value)}
                      placeholder="Ex: Culture sous abri, paillage organique..."
                      className="w-full p-2.5 border border-amber-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveHarvestDetails}
                    disabled={updateHarvestMutation.isPending}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>
                      {updateHarvestMutation.isPending
                        ? 'Enregistrement...'
                        : 'Mettre à jour les données du lot'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inspection Checklist */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">
              Grille de conformité qualité
            </h3>
            <p className="text-xs text-gray-500">
              Cochez les critères validés et ajoutez vos remarques.
            </p>
          </div>

          <div className="space-y-3">
            {(Object.keys(CHECKLIST_LABELS) as (keyof typeof CHECKLIST_LABELS)[]).map(
              (key) => {
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
                            item.passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {meta.icon}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-gray-900">
                            {meta.title}
                          </h4>
                          <p className="text-[10px] text-gray-500 truncate">
                            {meta.subtitle}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          item.passed
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-rose-600 text-white shadow-2xs'
                        }`}
                      >
                        {item.passed ? 'Conforme' : 'Non-conforme'}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) =>
                        handleChecklistNotes(key, e.target.value)
                      }
                      placeholder="Remarques spécifiques sur ce critère..."
                      className="w-full mt-2 text-xs border border-gray-200 rounded-lg p-2 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#1a5c35]"
                    />
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Inspection Photos & Samples */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Photos d'inspection &amp; Échantillons ({allPhotos.length})
              </h3>
              <p className="text-xs text-gray-500">
                Cliquez sur une photo pour zoomer et examiner les détails en haute résolution.
              </p>
            </div>
            {isFlaggedPhysical && !isCertified && (
              <button
                type="button"
                onClick={() => setShowManualInspectionModal(true)}
                className="px-3 py-1.5 bg-[#1a5c35] text-white text-xs font-bold rounded-xl hover:bg-[#144a2a] flex items-center gap-1.5 shadow-2xs active:scale-98 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">photo_camera</span>
                <span>Prendre des photos</span>
              </button>
            )}
          </div>

          {/* Photos grid */}
          {allPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {allPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  onClick={() => {
                    setZoomedImageIndex(index);
                    setZoomLevel(1);
                  }}
                  className="relative rounded-xl overflow-hidden border border-gray-200 group aspect-4/3 bg-gray-100 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                >
                  <img
                    src={photo.url}
                    alt={`Inspection photo ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 bg-white/90 text-gray-900 rounded-full shadow-sm">
                      <span className="material-symbols-outlined text-lg">zoom_in</span>
                    </span>
                    {!isCertified && photo.isReportPhoto && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          activeReportId &&
                            removePhoto.mutate({
                              id: activeReportId,
                              photoId: photo.id,
                            });
                        }}
                        className="p-2 bg-rose-600/90 text-white rounded-full hover:bg-rose-700 shadow-sm cursor-pointer"
                        title="Supprimer la photo"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    )}
                  </div>
                  <span className="absolute bottom-1 left-1 text-[9px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">
                    {photo.isReportPhoto ? 'GPS: Certifié conforme' : 'Photo producteur'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <span className="material-symbols-outlined text-3xl text-gray-400">no_photography</span>
              <p className="text-xs text-gray-500 mt-1">Aucune photo enregistrée pour ce lot.</p>
            </div>
          )}
        </div>

        {/* Manual Inspection & AI Vision Analysis Section */}
        {existingReport?.aiPreScreenScore != null ? (
          <div className="bg-gradient-to-br from-emerald-900 to-[#1a5c35] text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-2xl text-emerald-300">
                  fact_check
                </span>
                <div>
                  <h3 className="text-sm font-bold">Résultats de l'Inspection Manuelle &amp; IA</h3>
                  <p className="text-[11px] text-emerald-200">
                    Diagnostic établi à partir des photos terrain analysées.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xl font-bold bg-white/15 px-3 py-1 rounded-xl text-white border border-white/20">
                {Number(existingReport.aiPreScreenScore).toFixed(1)} / 10.0
              </span>
            </div>

            {existingReport.aiPreScreenNotes && (
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 text-xs text-emerald-50 space-y-1">
                <p className="font-bold text-emerald-200 text-[11px] uppercase tracking-wide">
                  Observations et Calibrage IA :
                </p>
                <p className="leading-relaxed whitespace-pre-line">
                  {existingReport.aiPreScreenNotes}
                </p>
              </div>
            )}

            {isFlaggedPhysical && !isCertified && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowManualInspectionModal(true)}
                  className="px-4 py-2 bg-white text-[#1a5c35] font-bold text-xs rounded-xl shadow-xs hover:bg-emerald-50 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                  <span>Reprendre des photos / Re-scanner</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          isFlaggedPhysical && !isCertified && (
            <div className="bg-white rounded-2xl p-5 border border-emerald-200 bg-linear-to-r from-emerald-50/50 via-white to-emerald-50/30 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#1a5c35] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-2xl">camera_alt</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Commencer l'inspection manuelle
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Prenez de nouvelles photos sur place pour capturer l'état réel de la récolte et lancer l'analyse de conformité.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManualInspectionModal(true)}
                className="w-full py-3 bg-[#1a5c35] hover:bg-[#144a2a] text-white font-bold text-xs rounded-xl shadow-xs active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">photo_camera</span>
                <span>Commencer l'inspection manuelle</span>
              </button>
            </div>
          )
        )}

        {/* Final Quality Score Assignment */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">
                Score de Qualité Final
              </h3>
              <p className="text-xs text-gray-500">
                Attribuez la note officielle finale certifiée.
              </p>
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
            disabled={isCertified}
            onChange={(e) => setFinalQualityScore(parseFloat(e.target.value))}
            className="w-full accent-[#1a5c35] cursor-pointer disabled:opacity-75 disabled:cursor-default"
          />

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Conclusion générale de l'inspecteur
            </label>
            <textarea
              rows={3}
              value={overallNotes}
              readOnly={isCertified}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder="Rédigez ici vos observations finales pour le producteur et les acheteurs..."
              className="w-full text-xs border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
            />
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Bar with 3 Multi-Action Controls */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {isCertified ? (
            <div className="w-full flex items-center justify-between px-2 py-1">
              <div className="flex items-center gap-2 text-[#1a5c35]">
                <span className="material-symbols-outlined text-lg">verified</span>
                <span className="text-xs font-bold">
                  Rapport d'audit certifié conforme &amp; archivé
                </span>
              </div>
              <Link
                to="/inspector/validate"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Retour aux inspections
              </Link>
            </div>
          ) : (
            <>
              {/* Action 1: Reject (Rose) */}
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="flex-1 py-3 px-2 bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl hover:bg-rose-100 active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
                Rejeter
              </button>

              {/* Action 2: Schedule / Reschedule Physical Visit (Amber) */}
              {isFlaggedPhysical ? (
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(true)}
                  className="flex-1 py-3 px-2 bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl hover:bg-amber-100 active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-amber-700">event_repeat</span>
                  Reprogrammer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDismissCapacityWarning(false);
                    setShowScheduleModal(true);
                  }}
                  className="flex-1 py-3 px-2 bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs rounded-xl hover:bg-amber-100 active:scale-98 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-amber-700">pin_drop</span>
                  Visite physique
                </button>
              )}

              {/* Action 3: Certify & Approve (Emerald Primary) */}
              <button
                type="button"
                onClick={() => setShowApproveModal(true)}
                disabled={submitReport.isPending || !activeReportId}
                className="flex-2 py-3 px-3 bg-[#1a5c35] text-white font-bold text-xs rounded-xl hover:bg-[#144a2a] active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                Valider & Certifier
              </button>
            </>
          )}
        </div>
      </footer>

      {/* Modal 1: Approve Confirmation Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#1a5c35] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-gray-900">
                Confirmer la certification
              </h3>
              <p className="text-xs text-gray-500">
                Vous certifiez ce lot avec la note de{' '}
                <span className="font-bold text-gray-900">
                  {finalQualityScore.toFixed(1)}/10
                </span>. Il sera immédiatement publié sur le marché.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  handleSubmitApprove();
                }}
                disabled={submitReport.isPending}
                className="flex-1 py-2.5 bg-[#1a5c35] text-white rounded-xl text-xs font-bold hover:bg-[#144a2a] cursor-pointer"
              >
                {submitReport.isPending ? 'Envoi...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Smart Scheduling Assistant (Soft Limit Alert) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">calendar_month</span>
                Planifier une inspection physique
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Ce lot sera marqué <span className="font-mono font-bold text-amber-700">FLAGGED_PHYSICAL</span> et déplacé dans votre planning de visites.
            </p>

            {/* Soft Limit Warning Banner */}
            {isOverCapacity && !dismissCapacityWarning && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">warning</span>
                  <div>
                    <p className="font-bold">Capacité journalière recommandée atteinte</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {dayVisits.length} visites sont déjà programmées pour le {visitDate}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissCapacityWarning(true)}
                  className="text-[11px] font-bold text-amber-900 underline hover:no-underline cursor-pointer"
                >
                  Continuer quand même (ignorer l'avertissement)
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Date de la visite
                </label>
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => {
                    setVisitDate(e.target.value);
                    setDismissCapacityWarning(false);
                  }}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Heure indicative
                </label>
                <input
                  type="time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Instructions pour la visite terrain
                </label>
                <textarea
                  rows={3}
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Précisez la raison de l'audit physique sur site..."
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmScheduleVisit}
                disabled={verifyHarvestMutation.isPending}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                {verifyHarvestMutation.isPending ? 'Planification...' : 'Valider la visite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Rejection with Mandatory Reason */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">gpp_bad</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">Rejeter ce lot</h3>
                <p className="text-[11px] text-gray-500">Un motif explicatif est obligatoire</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Motif du rejet (visible par le producteur) <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Taux de pourriture > 15%, calibrage non conforme..."
                className="w-full text-xs border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || verifyHarvestMutation.isPending}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyHarvestMutation.isPending ? 'Envoi...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Reschedule Physical Inspection */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">event_repeat</span>
                Reprogrammer la visite physique
              </h3>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Modifiez la date ou l'heure de passage pour l'inspection terrain de ce lot.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nouvelle date de visite
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nouvelle heure indicative
                </label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Instructions ou motif du report
                </label>
                <textarea
                  rows={3}
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="Précisez la raison de la reprogrammation..."
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRescheduleVisit}
                disabled={updateVisitMutation.isPending || createVisitMutation.isPending}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 cursor-pointer disabled:opacity-50"
              >
                {updateVisitMutation.isPending ? 'Enregistrement...' : 'Confirmer la reprogrammation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Manual Inspection (Take new pictures & re-analyse) */}
      {showManualInspectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#1a5c35] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">photo_camera</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Inspection Manuelle sur le Terrain
                  </h3>
                  <p className="text-xs text-gray-500">
                    Prenez de nouvelles photos et lancez l'analyse IA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualInspectionModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Capture / Upload actions */}
              <div className="grid grid-cols-2 gap-3">
                {/* Hidden Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                />

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadMedia.isPending || addPhoto.isPending}
                  className="p-4 border-2 border-dashed border-emerald-600/40 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <span className="material-symbols-outlined text-3xl text-[#1a5c35]">
                    photo_camera
                  </span>
                  <span className="text-xs font-bold text-[#1a5c35]">
                    Prendre une photo
                  </span>
                  <span className="text-[10px] text-gray-500">Caméra mobile</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadMedia.isPending || addPhoto.isPending}
                  className="p-4 border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                >
                  <span className="material-symbols-outlined text-3xl text-gray-600">
                    photo_library
                  </span>
                  <span className="text-xs font-bold text-gray-800">
                    Importer galerie
                  </span>
                  <span className="text-[10px] text-gray-500">Fichiers récents</span>
                </button>
              </div>

              {(uploadMedia.isPending || addPhoto.isPending) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 text-xs text-emerald-800">
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  <span>Téléversement de la photo d'inspection en cours...</span>
                </div>
              )}

              {/* Current photos for this report */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-gray-700">
                    Photos d'inspection associées ({allPhotos.length})
                  </h4>
                  <span className="text-[10px] text-gray-500">
                    Échantillons analysés
                  </span>
                </div>

                {allPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {allPhotos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="relative rounded-xl overflow-hidden border border-gray-200 aspect-square group bg-gray-100"
                      >
                        <img
                          src={photo.url}
                          alt={`Inspection sample ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {photo.isReportPhoto && (
                          <button
                            type="button"
                            onClick={() =>
                              activeReportId &&
                              removePhoto.mutate({
                                id: activeReportId,
                                photoId: photo.id,
                              })
                            }
                            className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full shadow-xs cursor-pointer"
                            title="Supprimer la photo"
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              delete
                            </span>
                          </button>
                        )}
                        <span className="absolute bottom-1 left-1 text-[8px] font-mono text-white bg-black/60 px-1 py-0.5 rounded">
                          {photo.isReportPhoto ? 'Terrain' : 'Déclarée'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-xs text-gray-500">
                      Aucune photo ajoutée. Prenez au moins une photo pour lancer l'analyse.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowManualInspectionModal(false)}
                disabled={isProcessingManualInspection}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleRunManualInspectionAnalysis}
                disabled={
                  isProcessingManualInspection ||
                  allPhotos.length === 0 ||
                  uploadMedia.isPending ||
                  addPhoto.isPending
                }
                className="flex-2 py-2.5 bg-[#1a5c35] text-white rounded-xl text-xs font-bold hover:bg-[#144a2a] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isProcessingManualInspection ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span>Analyse en cours...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span>Lancer l'analyse et enregistrer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal for Inspection Images */}
      {zoomedImageIndex !== null && allPhotos[zoomedImageIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-between p-4 select-none"
          onClick={() => {
            setZoomedImageIndex(null);
            setZoomLevel(1);
          }}
        >
          {/* Header Controls */}
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white py-2 px-3 bg-black/40 rounded-2xl backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold">
                Photo {zoomedImageIndex + 1} / {allPhotos.length}
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                {allPhotos[zoomedImageIndex].isReportPhoto
                  ? 'Inspection terrain (GPS validé)'
                  : 'Photo producteur'}
              </span>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
                disabled={zoomLevel <= 1}
                className="p-1.5 hover:bg-white/20 rounded-lg disabled:opacity-30 cursor-pointer"
                title="Dézoomer"
              >
                <span className="material-symbols-outlined text-lg">zoom_out</span>
              </button>
              <span className="text-xs font-mono w-10 text-center">
                {zoomLevel.toFixed(1)}x
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
                disabled={zoomLevel >= 3}
                className="p-1.5 hover:bg-white/20 rounded-lg disabled:opacity-30 cursor-pointer"
                title="Zoomer"
              >
                <span className="material-symbols-outlined text-lg">zoom_in</span>
              </button>
              {zoomLevel !== 1 && (
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="text-[11px] px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-bold cursor-pointer"
                >
                  Réinitialiser
                </button>
              )}
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button
                type="button"
                onClick={() => {
                  setZoomedImageIndex(null);
                  setZoomLevel(1);
                }}
                className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer"
                title="Fermer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>

          {/* Main Image Display */}
          <div
            className="flex-1 w-full max-w-4xl flex items-center justify-center overflow-auto my-3 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Previous button */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedImageIndex((prev) =>
                    prev !== null
                      ? (prev - 1 + allPhotos.length) % allPhotos.length
                      : null,
                  );
                  setZoomLevel(1);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all cursor-pointer"
                title="Photo précédente"
              >
                <span className="material-symbols-outlined text-2xl">chevron_left</span>
              </button>
            )}

            <div className="overflow-auto max-h-[75vh] max-w-full flex items-center justify-center">
              <img
                src={allPhotos[zoomedImageIndex].url}
                alt={`Photo inspectée ${zoomedImageIndex + 1}`}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                }}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl cursor-grab"
                onClick={() => setZoomLevel((z) => (z === 1 ? 2 : 1))}
              />
            </div>

            {/* Next button */}
            {allPhotos.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedImageIndex((prev) =>
                    prev !== null ? (prev + 1) % allPhotos.length : null,
                  );
                  setZoomLevel(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all cursor-pointer"
                title="Photo suivante"
              >
                <span className="material-symbols-outlined text-2xl">chevron_right</span>
              </button>
            )}
          </div>

          {/* Footer Info */}
          <div
            className="text-center text-gray-300 text-xs py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Utilisez les flèches du clavier ou cliquez sur l'image pour basculer le zoom (1x / 2x).</span>
          </div>
        </div>
      )}
    </div>
  );
}
