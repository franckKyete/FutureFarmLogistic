import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useProducers } from '@/features/inspector/api/accounts.queries';
import { useCamera } from '@/hooks/useCamera';
import {
  aiClassifyHarvestMutation,
  mediaUploadMutation,
} from '@/features/harvests/api/harvests.queries';
import { CreateProducerModal } from '@/features/inspector/components/CreateProducerModal';
import {
  HarvestUnit,
  InspectionChecklistItem,
  InspectionChecklist,
} from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/inspector/proxy')({
  component: InspectorProactiveInspectionPage,
});

interface ProductTemplate {
  id: string;
  name: string;
  category: string;
}

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
  [InspectionChecklistItem.LABELING]: {
    passed: true,
    notes: 'Étiquetage et traçabilité vérifiés',
  },
};

const CHECKLIST_LABELS: Record<
  InspectionChecklistItem,
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
  [InspectionChecklistItem.LABELING]: {
    title: 'Étiquetage & Traçabilité',
    subtitle: 'Origine parcelle et numéro de lot',
    icon: 'qr_code_2',
  },
};

function InspectorProactiveInspectionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Wizard Step: 1 = Choose Farmer, 2 = AI Camera Analysis, 3 = Audit & Certification Form
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Farmer Selection
  const [farmerSearch, setFarmerSearch] = useState('');
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [showCreateFarmerModal, setShowCreateFarmerModal] = useState(false);

  const farmerFilter = { role: 'farmer' as const, ...(farmerSearch ? { search: farmerSearch } : {}) };
  const { data: producers = [], isLoading: producersLoading } = useProducers(farmerFilter);

  const selectedFarmer = producers.find((p) => p.id === selectedFarmerId);

  // Step 2: Camera & AI Vision Classification
  const [images, setImages] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [classifiedData, setClassifiedData] = useState<any | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { videoRef, isActive, capture } = useCamera();

  // Step 3: Audit Form & Certification
  const { data: products = [] } = useQuery<ProductTemplate[]>({
    queryKey: ['products', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ProductTemplate[] }>('/products');
      return data.data || [];
    },
  });

  const [selectedProductId, setSelectedProductId] = useState('');
  const [cropCustomName, setCropCustomName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [pricePerUnit, setPricePerUnit] = useState<number | ''>('');
  const [unit, setUnit] = useState<HarvestUnit>(HarvestUnit.KG);
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [farmingMethods, setFarmingMethods] = useState('');
  const [finalQualityScore, setFinalQualityScore] = useState<number>(8.5);
  const [checklist, setChecklist] = useState<InspectionChecklist>(DEFAULT_CHECKLIST);
  const [overallAuditNotes, setOverallAuditNotes] = useState('');

  // AI Classification Mutation
  const classifyMutation = useMutation({
    ...aiClassifyHarvestMutation(),
    onSuccess: (data) => {
      setClassifiedData(data);
      addToast('Analyse de récolte IA terminée !', 'success');

      // Pre-fill Step 3 fields
      if (data.suggestedProductId) {
        setSelectedProductId(data.suggestedProductId);
      }
      if (data.suggestedName) {
        setCropCustomName(data.suggestedName);
      }
      if (data.estimatedQuantity) {
        setQuantity(Number(data.estimatedQuantity));
      }
      if (data.suggestedPricePerUnit) {
        setPricePerUnit(Number(data.suggestedPricePerUnit));
      }
      if (data.farmingMethods) {
        setFarmingMethods(data.farmingMethods);
      }
      if (data.aiQualityScore) {
        setFinalQualityScore(Number(data.aiQualityScore));
      }
    },
    onError: (err: any) => {
      addToast(err?.message || 'Erreur lors de la classification IA', 'error');
    },
  });

  // Media upload mutation
  const uploadMutation = useMutation({
    ...mediaUploadMutation(),
    onSuccess: (result) => {
      setImages((prev) => [...prev, result.url]);
    },
    onError: () => {
      addToast("Erreur lors de l'upload de l'image", 'error');
    },
  });

  // Create & Certify Harvest Proxy Mutation
  const createAndCertifyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/harvests/proxy', payload);
      return data.data;
    },
    onSuccess: () => {
      addToast('Récolte enregistrée et certifiée avec succès !', 'success');
      queryClient.invalidateQueries({ queryKey: ['inspector'] });
      void navigate({ to: '/inspector/validate' });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        "Erreur lors de l'enregistrement de la récolte";
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach((file) => uploadMutation.mutate(file));
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCameraClick = async () => {
    if (isActive) {
      const file = await capture();
      if (file) uploadMutation.mutate(file);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleTriggerAiAnalysis = () => {
    if (images.length === 0) {
      addToast('Veuillez ajouter au moins une photo de la récolte.', 'warning');
      return;
    }
    const payload: { photoUrls: string[]; additionalNotes?: string } = {
      photoUrls: images,
    };
    if (additionalNotes) {
      payload.additionalNotes = additionalNotes;
    }
    classifyMutation.mutate(payload);
  };

  const handleToggleChecklist = (key: InspectionChecklistItem) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        passed: !prev[key].passed,
      },
    }));
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmerId || (!selectedProductId && !cropCustomName) || !quantity || !pricePerUnit) {
      addToast('Veuillez renseigner tous les champs obligatoires.', 'error');
      return;
    }

    createAndCertifyMutation.mutate({
      farmerUserId: selectedFarmerId,
      productId: selectedProductId || undefined,
      productName: cropCustomName || undefined,
      quantityInStock: Number(quantity),
      stockMarge: 0,
      pricePerUnit: Number(pricePerUnit),
      unit,
      harvestDate,
      expirationDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      farmingMethods: farmingMethods || 'Culture traditionnelle locale',
      photoUrls: images,
      qualityScore: finalQualityScore,
      status: 'APPROVED',
      auditNotes: overallAuditNotes,
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-28">
      {/* Wizard Step Indicator Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a5c35]">
              Nouvelle Inspection Terrain
            </span>
            <h1 className="text-base font-bold text-[#0b1c30]">
              {currentStep === 1 && 'Étape 1 : Sélectionner le Producteur'}
              {currentStep === 2 && 'Étape 2 : Photo & Analyse IA Vision'}
              {currentStep === 3 && 'Étape 3 : Audit Physique & Certification'}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            <span className={currentStep === 1 ? 'text-[#1a5c35]' : ''}>1</span>
            <span>•</span>
            <span className={currentStep === 2 ? 'text-[#1a5c35]' : ''}>2</span>
            <span>•</span>
            <span className={currentStep === 3 ? 'text-[#1a5c35]' : ''}>3</span>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto w-full space-y-5">
        {/* ==================================================================== */}
        {/* STEP 1: CHOOSE FARMER                                                */}
        {/* ==================================================================== */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#0b1c30]">
                    Producteur visité
                  </h2>
                  <p className="text-xs text-gray-500">
                    Sélectionnez le producteur pour lequel vous inspectez la récolte.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateFarmerModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-[#1a5c35] border border-emerald-200 rounded-xl text-xs font-bold hover:bg-[#1a5c35] hover:text-white transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  <span>Enrôler un nouveau</span>
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={farmerSearch}
                  onChange={(e) => setFarmerSearch(e.target.value)}
                  placeholder="Rechercher par nom, ferme ou email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>

              {/* Farmers list */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {producersLoading ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    Chargement des producteurs...
                  </div>
                ) : producers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Aucun producteur trouvé. Enrôlez-en un pour démarrer.
                  </div>
                ) : (
                  producers.map((farmer) => {
                    const isSelected = selectedFarmerId === farmer.id;
                    return (
                      <div
                        key={farmer.id}
                        onClick={() => setSelectedFarmerId(farmer.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#1a5c35] bg-emerald-50/40 ring-1 ring-[#1a5c35]'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#1a5c35] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {farmer.firstName?.charAt(0)}
                            {farmer.lastName?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-gray-900 truncate">
                              {farmer.firstName} {farmer.lastName}
                            </h3>
                            <p className="text-[11px] text-gray-500 truncate">
                              {farmer.farmName || farmer.email}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-[#1a5c35] bg-[#1a5c35] text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <span className="material-symbols-outlined text-xs">check</span>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Next Button */}
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!selectedFarmerId}
              className="w-full py-3.5 bg-[#1a5c35] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[#144a2a] disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Continuer vers la prise de vue & analyse IA</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* STEP 2: CAMERA CAPTURE & AI VISION PRE-SCREENING                     */}
        {/* ==================================================================== */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Farmer context badge */}
            <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-[#1a5c35]">person</span>
                <span className="font-bold text-gray-900">
                  {selectedFarmer?.firstName} {selectedFarmer?.lastName}
                </span>
                {selectedFarmer?.farmName && (
                  <span className="text-gray-500">({selectedFarmer.farmName})</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-[11px] font-bold text-[#1a5c35] hover:underline cursor-pointer"
              >
                Changer
              </button>
            </div>

            {/* Camera Viewfinder / Photo Capture Card */}
            <div className="bg-black rounded-2xl overflow-hidden border border-gray-900 shadow-md relative min-h-[300px] flex flex-col justify-between">
              {/* Camera viewfinder */}
              {isActive ? (
                <div className="absolute inset-0 z-0">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/15 z-1" />
                </div>
              ) : (
                <div className="p-8 text-center text-white/70 flex flex-col items-center justify-center flex-1 space-y-2">
                  <span className="material-symbols-outlined text-4xl text-emerald-400">
                    photo_camera
                  </span>
                  <p className="text-xs font-bold text-white">
                    Prenez des photos nettes de la récolte
                  </p>
                  <p className="text-[11px] text-gray-400">
                    L'IA Gemini analysera la qualité, la variété et le calibre
                  </p>
                </div>
              )}

              {/* Top bar on camera */}
              <div className="relative z-10 p-3 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
                <span className="text-[11px] font-bold text-white bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md">
                  {images.length} photo{images.length > 1 ? 's' : ''} capturée{images.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Bottom camera controls */}
              <div className="relative z-10 p-4 bg-gradient-to-t from-black/80 to-transparent space-y-3">
                {/* Thumbnails */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/40">
                      <img src={imgUrl} alt="Vignette" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 bg-rose-600 rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {uploadMutation.isPending && (
                    <div className="w-12 h-12 rounded-lg border border-dashed border-emerald-400 flex items-center justify-center bg-white/10 shrink-0">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-400 border-t-transparent" />
                    </div>
                  )}

                  {/* Add from gallery */}
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-12 h-12 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/10 text-white shrink-0 hover:bg-white/20 cursor-pointer"
                    title="Galerie"
                  >
                    <span className="material-symbols-outlined text-lg">photo_library</span>
                  </button>
                </div>

                {/* Capture & File Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGallerySelect}
                  className="hidden"
                />

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    disabled={uploadMutation.isPending}
                    className="w-16 h-16 rounded-full bg-white/20 border-4 border-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Additional Notes for AI */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-gray-700">
                Remarques / Précisions pour l'analyse IA (Optionnel)
              </label>
              <input
                type="text"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Ex: Récolté ce matin à l'aube, culture sous ombrage..."
                className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>

            {/* AI Classification Trigger & Result */}
            {classifiedData ? (
              <div className="bg-emerald-950 text-white rounded-2xl p-5 border border-emerald-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-400 text-2xl">
                      auto_awesome
                    </span>
                    <h3 className="text-sm font-bold">Résultat de l'analyse IA</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full">
                    {classifiedData.isIdentified ? 'Culture Détectée ✓' : 'Non identifié'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-emerald-300 text-[10px] uppercase font-bold block">Culture</span>
                    <span className="font-bold text-sm text-white">{classifiedData.suggestedName || 'Produit'}</span>
                  </div>
                  <div>
                    <span className="text-emerald-300 text-[10px] uppercase font-bold block">Score Qualité Estimé</span>
                    <span className="font-bold text-sm text-white font-mono">
                      {classifiedData.aiQualityScore ? `${Number(classifiedData.aiQualityScore).toFixed(1)}/10` : '8.5/10'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-300 text-[10px] uppercase font-bold block">Quantité Estimée</span>
                    <span className="font-bold text-white font-mono">
                      {classifiedData.estimatedQuantity ? `${classifiedData.estimatedQuantity} Kg` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-300 text-[10px] uppercase font-bold block">Prix Suggéré</span>
                    <span className="font-bold text-white font-mono">
                      {classifiedData.suggestedPricePerUnit ? `${classifiedData.suggestedPricePerUnit.toLocaleString()} CDF` : '—'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs transition-colors active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Valider et passer au formulaire d'audit</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer hover:bg-gray-200"
                >
                  Retour
                </button>
                <button
                  type="button"
                  onClick={handleTriggerAiAnalysis}
                  disabled={images.length === 0 || classifyMutation.isPending}
                  className="flex-1 py-3 bg-[#1a5c35] text-white rounded-xl font-bold text-xs shadow-sm hover:bg-[#144a2a] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  <span>{classifyMutation.isPending ? 'Analyse Gemini en cours...' : 'Analyser la récolte avec l\'IA'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* STEP 3: PHYSICAL AUDIT & FINAL CERTIFIED CREATION                   */}
        {/* ==================================================================== */}
        {currentStep === 3 && (
          <form onSubmit={handleFinalSubmit} className="space-y-5">
            {/* Header Summary */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a5c35] block">
                Récapitulatif Terrain
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {cropCustomName || 'Lot Agricole'}
                  </h3>
                  <p className="text-xs text-gray-600">
                    Producteur : {selectedFarmer?.firstName} {selectedFarmer?.lastName}
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-sm font-bold text-[#1a5c35]">
                  <span>{finalQualityScore.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">/10</span>
                </div>
              </div>
            </div>

            {/* Product & Quantity Specification */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
                Données du Lot
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Modèle de produit
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
                  >
                    <option value="">-- Sélectionner ou personnaliser --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Nom / Variété du produit
                  </label>
                  <input
                    type="text"
                    value={cropCustomName}
                    onChange={(e) => setCropCustomName(e.target.value)}
                    required
                    placeholder="Ex: Maïs Jaune Grain"
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Quantité certifiée
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                    placeholder="Ex: 500"
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Unité
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as HarvestUnit)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
                  >
                    <option value={HarvestUnit.KG}>Kilogrammes (KG)</option>
                    <option value={HarvestUnit.TON}>Tonnes (TON)</option>
                    <option value={HarvestUnit.PIECE}>Pièces (PIECE)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Prix unitaire officiel (CDF / {unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                    placeholder="Ex: 2500"
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Date de récolte
                  </label>
                  <input
                    type="date"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    required
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35]"
                  />
                </div>
              </div>
            </div>

            {/* Quality Checklist */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2">
                Grille de Conformité Qualité
              </h3>

              <div className="space-y-2.5">
                {(Object.keys(CHECKLIST_LABELS) as InspectionChecklistItem[]).map((key) => {
                  const meta = CHECKLIST_LABELS[key];
                  const item = checklist[key] || { passed: true, notes: '' };

                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        item.passed ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-base text-[#1a5c35]">
                          {meta.icon}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-gray-900">{meta.title}</h4>
                          <p className="text-[10px] text-gray-500">{meta.subtitle}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(key)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          item.passed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                      >
                        {item.passed ? 'Conforme' : 'Non-conforme'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality Score Slider */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Score de Qualité Final
                  </h3>
                  <p className="text-[11px] text-gray-500">Note attribuée et certifiée par l'inspecteur</p>
                </div>
                <span className="font-mono text-xl font-bold text-[#1a5c35]">
                  {finalQualityScore.toFixed(1)} / 10.0
                </span>
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
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Observations finales de l'inspecteur
                </label>
                <textarea
                  rows={2}
                  value={overallAuditNotes}
                  onChange={(e) => setOverallAuditNotes(e.target.value)}
                  placeholder="Observations sur le calibrage, l'emballage et les conditions de stockage..."
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer hover:bg-gray-200"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={createAndCertifyMutation.isPending}
                className="flex-1 py-3.5 bg-[#1a5c35] text-white rounded-xl font-bold text-xs shadow-md hover:bg-[#144a2a] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">verified</span>
                <span>{createAndCertifyMutation.isPending ? 'Enregistrement...' : 'Enregistrer et Certifier la Récolte'}</span>
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Modal for creating a new farmer */}
      <CreateProducerModal
        isOpen={showCreateFarmerModal}
        onClose={() => setShowCreateFarmerModal(false)}
      />
    </div>
  );
}
