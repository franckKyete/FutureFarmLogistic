import { useState, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiClassifyHarvestMutation, mediaUploadMutation } from '@/features/harvests/api/harvests.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { useOfflineSyncState, saveTempDraft } from '@/features/harvests/offline';
import { type AiClassifyHarvestResponseDto } from '@futurefarm/types';

export interface HarvestAnalyzeNavParams {
  isIdentified?: string | undefined;
  productId?: string | undefined;
  quantity?: string | undefined;
  pricePerUnit?: string | undefined;
  shelfLifeDays?: string | undefined;
  farmingMethods?: string | undefined;
  photoUrl?: string | undefined;
  photoUrls?: string | undefined;
  featuredPhotoIndex?: string | undefined;
  qualityScore?: string | undefined;
  draftId?: string | undefined;
  farmerUserId?: string | undefined;
  farmerName?: string | undefined;
}

export interface HarvestAnalyzeViewProps {
  onNavigateBack: () => void;
  onProceedToForm: (params: HarvestAnalyzeNavParams) => void;
  isProxy?: boolean | undefined;
  farmerUserId?: string | undefined;
  farmerName?: string | undefined;
}

export function HarvestAnalyzeView({
  onNavigateBack,
  onProceedToForm,
  isProxy = false,
  farmerUserId,
  farmerName,
}: HarvestAnalyzeViewProps) {
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineSyncState();
  const [images, setImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [classifiedData, setClassifiedData] = useState<AiClassifyHarvestResponseDto | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { videoRef, isActive, error: cameraError, capture } = useCamera();

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  };

  // Mutation for photo analysis
  const classify = useMutation({
    ...aiClassifyHarvestMutation(),
    onSuccess: (data) => {
      setClassifiedData(data);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast('Analyse de récolte terminée !', 'success');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Erreur lors de la classification', 'error');
    },
  });

  const uploadFile = useMutation({
    ...mediaUploadMutation(),
    onSuccess: (result) => {
      setImages((prev) => [...prev, result.url]);
      setActiveImageIndex(images.length);
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : "Erreur lors de l'upload de l'image", 'error');
    },
  });

  const handleProcessFile = async (file: File) => {
    if (!isOnline) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setImages((prev) => [...prev, dataUrl]);
        setActiveImageIndex(images.length);
      } catch {
        addToast("Erreur lors de la lecture de l'image", 'error');
      }
    } else {
      uploadFile.mutate(file);
    }
  };

  const handleAnalyze = () => {
    if (images.length === 0) {
      addToast('Veuillez ajouter au moins une photo.', 'warning');
      return;
    }
    const payload: { photoUrls: string[]; additionalNotes?: string } = {
      photoUrls: images,
    };
    if (additionalNotes) {
      payload.additionalNotes = additionalNotes;
    }
    classify.mutate(payload);
  };

  const handleOfflineContinue = async () => {
    if (images.length === 0) {
      addToast('Veuillez ajouter au moins une photo.', 'warning');
      return;
    }
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await saveTempDraft({
      id: draftId,
      status: 'DRAFT_IN_PROGRESS',
      isProxy: isProxy ? true : undefined,
      farmerUserId: isProxy ? farmerUserId : undefined,
      farmerName: isProxy ? farmerName : undefined,
      localPhotos: images,
      featuredPhotoIndex: activeImageIndex || 0,
      additionalNotes: additionalNotes.trim() || undefined,
    });

    onProceedToForm({
      draftId,
      farmerUserId,
      farmerName,
    });
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleProcessFile(file);
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach((file) => void handleProcessFile(file));
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
    setActiveImageIndex((prev) => {
      if (prev === index) return Math.max(0, index - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const handleCameraClick = async () => {
    if (isActive) {
      const file = await capture();
      if (file) void handleProcessFile(file);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleContinue = () => {
    if (!classifiedData) return;

    // Map and round quality score (0.0 - 10.0 range mapped to 0-100 percentage)
    const qualityPercent = classifiedData.aiQualityScore
      ? Math.round(classifiedData.aiQualityScore * 10)
      : 90;

    onProceedToForm({
      isIdentified: classifiedData.isIdentified ? 'true' : 'false',
      productId: classifiedData.suggestedProductId || '',
      quantity: classifiedData.estimatedQuantity ? String(classifiedData.estimatedQuantity) : '',
      pricePerUnit: classifiedData.suggestedPricePerUnit ? String(classifiedData.suggestedPricePerUnit) : '',
      shelfLifeDays: classifiedData.recommendedShelfLifeDays ? String(classifiedData.recommendedShelfLifeDays) : '30',
      farmingMethods: classifiedData.farmingMethods || '',
      photoUrl: images[activeImageIndex] || '',
      photoUrls: images.length > 0 ? JSON.stringify(images) : undefined,
      featuredPhotoIndex: String(activeImageIndex || 0),
      qualityScore: String(qualityPercent),
      farmerUserId,
      farmerName,
    });
  };

  return (
    <div className="bg-black text-white min-h-screen overflow-hidden select-none relative">
      {/* Camera viewfinder (always visible when camera is active) */}
      {isActive && (
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
      )}

      {/* Full-screen image preview modal */}
      {showPreview && images.length > 0 && (
        <div className="absolute inset-0 z-40 bg-black/95 flex items-center justify-center">
          <img
            alt="Aperçu"
            className="w-full h-full object-contain"
            src={images[activeImageIndex]}
          />
          {/* Preview: close button */}
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-6 left-4 w-10 h-10 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform cursor-pointer z-10"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          {/* Preview: delete button */}
          <button
            onClick={() => {
              handleRemoveImage(activeImageIndex);
              setShowPreview(false);
            }}
            className="absolute top-6 right-4 w-10 h-10 flex items-center justify-center bg-red-600/80 rounded-full text-white active:scale-95 transition-transform cursor-pointer z-10"
          >
            <span className="material-symbols-outlined text-2xl">delete</span>
          </button>
        </div>
      )}

      {/* Capture button overlaid on camera viewfinder */}
      {isActive && !showPreview && (
        <div className="absolute left-0 right-0 z-20 flex justify-center" style={{ bottom: '200px' }}>
          <button
            onClick={handleCameraClick}
            disabled={uploadFile.isPending}
            className="w-18 h-18 rounded-full bg-white/20 backdrop-blur-xs border-4 border-white flex items-center justify-center active:scale-90 transition-transform cursor-pointer disabled:opacity-40"
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>
        </div>
      )}

      {/* Top Header: Close Button & Proxy Farmer Indicator */}
      <header className="absolute top-0 left-0 w-full z-50 p-4 pt-6 flex items-center justify-between">
        <button
          onClick={onNavigateBack}
          className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform cursor-pointer border border-white/10"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>

        {isProxy && farmerName && (
          <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-3.5 py-1.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-sm">person</span>
            <span className="text-xs font-bold text-emerald-300 truncate max-w-[200px]">
              {farmerName}
            </span>
          </div>
        )}
      </header>

      {/* Analysis Loading / Result Overlay */}
      {(classify.isPending || classifiedData) && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          {classify.isPending ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
              <p className="text-sm font-semibold tracking-wide">Analyse IA de la récolte en cours...</p>
            </div>
          ) : classifiedData ? (
            <div className="space-y-6 max-w-sm bg-white text-[#0b1c30] p-6 rounded-2xl shadow-xl w-full">
              <div className="flex flex-col items-center text-center">
                <span
                  className={`material-symbols-outlined text-[56px] mb-2 ${
                    classifiedData.isIdentified ? 'text-[#004322]' : 'text-amber-600'
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {classifiedData.isIdentified ? 'stars' : 'help'}
                </span>
                <h3 className="font-display text-lg font-bold text-[#004322] tracking-tight">
                  {classifiedData.isIdentified ? "Culture Identifiée par l'IA" : "Culture Non Identifiée"}
                </h3>
                {isProxy && farmerName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Lot pour : <span className="font-semibold text-gray-800">{farmerName}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3 text-left border-y border-[#c0c9be] py-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#707970] font-semibold">Statut identification :</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      classifiedData.isIdentified
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {classifiedData.isIdentified ? 'Identifié ✓' : 'À renseigner manuellement'}
                  </span>
                </div>
                {classifiedData.isIdentified && (
                  <div className="flex justify-between">
                    <span className="text-[#707970] font-semibold">Culture détectée :</span>
                    <span className="font-bold text-[#0b1c30]">{classifiedData.suggestedName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#707970] font-semibold">Qualité IA estimée :</span>
                  <span className="font-bold text-[#1a5c35]">
                    {classifiedData.aiQualityScore ? Math.round(classifiedData.aiQualityScore * 10) : 90}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707970] font-semibold">Quantité estimée :</span>
                  <span className="font-bold text-[#0b1c30]">
                    {classifiedData.estimatedQuantity ? `${classifiedData.estimatedQuantity} Kg` : 'Non estimée'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#707970] font-semibold">Prix suggéré :</span>
                  <span className="font-bold text-[#004322]">
                    {classifiedData.suggestedPricePerUnit ? `${classifiedData.suggestedPricePerUnit.toLocaleString()} CDF/Kg` : 'Non estimé'}
                  </span>
                </div>
                <div className="pt-2 text-[10px] text-[#404941] italic">
                  {classifiedData.isIdentified
                    ? `Note : ${classifiedData.description || 'Culture enregistrée automatiquement.'}`
                    : "Note : L'IA n'a pas pu reconnaître la culture sur les photos. Vous pourrez spécifier le nom et la catégorie lors de la saisie."}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleContinue}
                  className="w-full bg-[#004322] text-white font-bold py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-xs"
                >
                  Continuer l'enregistrement
                </button>
                <button
                  onClick={() => setClassifiedData(null)}
                  className="w-full border border-[#707970] text-[#404941] font-semibold py-2.5 rounded-xl hover:bg-slate-50 active:scale-95 transition-all cursor-pointer text-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Bottom Bar (hidden during full-screen preview) */}
      {!showPreview && (
        <footer className="absolute bottom-0 left-0 w-full z-30 bg-black/85 backdrop-blur-xl border-t border-white/10 pb-8">
          <div className="p-4 space-y-6 max-w-[480px] mx-auto">
            {/* Notes description input */}
            <div className="space-y-1">
              <label className="text-[10px] text-white/60 font-semibold block px-1">
                Notes / Instructions supplémentaires (Optionnel)
              </label>
              <input
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-colors"
                placeholder="Ex: Soja fraîchement récolté ce matin..."
                type="text"
              />
            </div>

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGallerySelect}
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
            />

            {/* Horizontal Thumbnail List */}
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
              {images.length > 0 &&
                images.map((imgUrl, index) => {
                  const isActive = index === activeImageIndex;
                  return (
                    <div key={index} className="relative flex-shrink-0">
                      <button
                        onClick={() => {
                          setActiveImageIndex(index);
                          setShowPreview(true);
                        }}
                        className={`w-14 h-14 rounded-lg overflow-hidden transition-all cursor-pointer ${
                          isActive
                            ? 'border-2 border-white ring-2 ring-black/50 scale-105'
                            : 'border border-white/20 opacity-60'
                        }`}
                      >
                        <img alt={`Vignette ${index + 1}`} className="w-full h-full object-cover" src={imgUrl} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600/90 hover:bg-red-600 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer z-10"
                        title="Supprimer"
                      >
                        <span
                          className="material-symbols-outlined text-white text-[12px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          close
                        </span>
                      </button>
                    </div>
                  );
                })}

              {/* Upload loading indicator */}
              {uploadFile.isPending && (
                <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-emerald-500/40 flex items-center justify-center bg-white/5">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-emerald-500" />
                </div>
              )}

              {/* Add from gallery button (always visible) */}
              {!uploadFile.isPending && (
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer"
                  title="Choisir depuis la galerie"
                >
                  <span className="material-symbols-outlined text-white/60">photo_library</span>
                </button>
              )}

              {/* Camera error hint */}
              {cameraError && images.length === 0 && (
                <span className="text-[10px] text-amber-400 whitespace-nowrap">
                  Caméra non disponible. Utilisez la galerie.
                </span>
              )}
            </div>

            {/* Action Button */}
            <div className="pb-2">
              {!isOnline ? (
                <button
                  type="button"
                  onClick={handleOfflineContinue}
                  disabled={images.length === 0}
                  className="w-full bg-[#004322] hover:bg-[#1a5c35] text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">arrow_forward</span>
                  Continuer hors-ligne (Saisie manuelle)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={images.length === 0 || classify.isPending}
                  className="w-full bg-emerald-700 text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/25 cursor-pointer text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">analytics</span>
                  {classify.isPending ? 'Analyse en cours...' : 'Analyser la récolte'}
                </button>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
