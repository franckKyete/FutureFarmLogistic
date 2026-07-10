import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { aiClassifyHarvestMutation, mediaUploadMutation } from '@/features/harvests/api/harvests.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { Permission } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/harvests/analyze')({
  beforeLoad: () => {
    requireAuth(Permission.HARVEST_CREATE);
  },
  component: AnalyzePage,
});

function AnalyzePage() {
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [classifiedData, setClassifiedData] = useState<any | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { videoRef, isActive, error: cameraError, capture } = useCamera();

  // Mutation for photo analysis
  const classify = useMutation({
    ...aiClassifyHarvestMutation(),
    onSuccess: (data) => {
      setClassifiedData(data);
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

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile.mutate(file);
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach((file) => uploadFile.mutate(file));
    e.target.value = '';
  };

  const handleCameraClick = async () => {
    if (isActive) {
      const file = await capture();
      if (file) uploadFile.mutate(file);
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

    void navigate({
      to: '/farmer/harvests/new',
      search: {
        productId: classifiedData.suggestedProductId || '',
        quantity: classifiedData.estimatedQuantity ? String(classifiedData.estimatedQuantity) : '',
        pricePerUnit: classifiedData.suggestedPricePerUnit ? String(classifiedData.suggestedPricePerUnit) : '',
        shelfLifeDays: classifiedData.recommendedShelfLifeDays ? String(classifiedData.recommendedShelfLifeDays) : '30',
        farmingMethods: classifiedData.farmingMethods || '',
        photoUrl: images[activeImageIndex] || '',
        qualityScore: String(qualityPercent),
      },
    });
  };

  return (
    <div className="bg-black text-white min-h-screen overflow-hidden select-none relative">
      {/* Live camera preview when no images */}
      {images.length === 0 && isActive && (
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 z-1"></div>
        </div>
      )}

      {/* Immersive Background Image */}
      {images.length > 0 && (
        <div className="absolute inset-0 z-0 transition-all duration-500">
          <img
            alt="Récolte active"
            className="w-full h-full object-cover object-center transition-all duration-500"
            src={images[activeImageIndex]}
          />
          <div className="absolute inset-0 bg-black/40 z-1"></div>
        </div>
      )}

      {/* Top Action: Close Button */}
      <header className="absolute top-0 left-0 w-full z-50 p-4 pt-6">
        <button
          onClick={() => {
            void navigate({ to: '/farmer/stock' });
          }}
          className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform cursor-pointer border border-white/10"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
      </header>

      {/* Analysis Loading / Result Overlay */}
      {(classify.isPending || classifiedData) && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          {classify.isPending ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
              <p className="text-sm font-semibold tracking-wide">Analyse IA de la qualité en cours...</p>
            </div>
          ) : (
            <div className="space-y-6 max-w-sm bg-white text-[#0b1c30] p-6 rounded-2xl shadow-xl w-full">
              <div className="flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-[#004322] text-[56px] mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>
                  stars
                </span>
                <h3 className="font-display text-lg font-bold text-[#004322] tracking-tight">Rapport d'Analyse IA</h3>
              </div>

              <div className="space-y-3 text-left border-y border-[#c0c9be] py-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#707970] font-semibold">Produit détecté :</span>
                  <span className="font-bold text-[#0b1c30]">{classifiedData.suggestedName || 'Inconnu'}</span>
                </div>
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
                    {classifiedData.suggestedPricePerUnit ? `${classifiedData.suggestedPricePerUnit.toLocaleString()} FCFA/Kg` : 'Non estimé'}
                  </span>
                </div>
                <div className="pt-2 text-[10px] text-[#404941] italic">
                  Note : {classifiedData.description || 'Aucune note descriptive.'}
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
                  Recommencer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Bar (WhatsApp Story Style) */}
      <footer className="absolute bottom-0 left-0 w-full z-30 bg-black/85 backdrop-blur-xl border-t border-white/10 pb-8">
        <div className="p-4 space-y-6 max-w-[480px] mx-auto">
          {/* Notes description input */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/60 font-semibold block px-1">Notes / Instructions supplémentaires (Optionnel)</label>
            <input
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-white/10 transition-colors"
              placeholder="Ex: Soja fraîchement récolté ce matin..."
              type="text"
            />
          </div>

          {/* Hidden file inputs */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraCapture} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
          <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="absolute w-0 h-0 opacity-0 pointer-events-none" />

          {/* Horizontal Thumbnail List */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            {images.length > 0 && images.map((imgUrl, index) => {
              const isActive = index === activeImageIndex;
              return (
                <button
                  key={index}
                  onClick={() => setActiveImageIndex(index)}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all cursor-pointer ${
                    isActive ? 'border-2 border-white ring-2 ring-black/50 scale-105' : 'border border-white/20 opacity-60'
                  }`}
                >
                  <img alt={`Vignette ${index + 1}`} className="w-full h-full object-cover" src={imgUrl} />
                </button>
              );
            })}

            {/* Upload loading indicator */}
            {uploadFile.isPending && (
              <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-emerald-500/40 flex items-center justify-center bg-white/5">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-emerald-500" />
              </div>
            )}

            {/* Camera/gallery buttons when images exist */}
            {!uploadFile.isPending && images.length > 0 && (
              <>
                <button onClick={handleCameraClick} disabled={uploadFile.isPending} className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Prendre une photo">
                  <span className="material-symbols-outlined text-white/60">camera_alt</span>
                </button>
                <button onClick={() => galleryInputRef.current?.click()} className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer" title="Choisir depuis la galerie">
                  <span className="material-symbols-outlined text-white/60">photo_library</span>
                </button>
              </>
            )}

            {/* Empty state — show when no images and not uploading */}
            {images.length === 0 && !uploadFile.isPending && (
              <>
                <button onClick={handleCameraClick} disabled={uploadFile.isPending} className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" title="Prendre une photo">
                  <span className="material-symbols-outlined text-white/60">camera_alt</span>
                </button>
                <button onClick={() => galleryInputRef.current?.click()} className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer" title="Choisir depuis la galerie">
                  <span className="material-symbols-outlined text-white/60">photo_library</span>
                </button>
                {cameraError && (
                  <span className="text-[10px] text-amber-400 whitespace-nowrap">Caméra non disponible. Utilisez la galerie.</span>
                )}
                <span className="text-[10px] text-white/40 whitespace-nowrap">Ajoutez une photo</span>
              </>
            )}
          </div>

          {/* Action Button */}
          <div className="pb-2">
            <button
              onClick={handleAnalyze}
              disabled={images.length === 0 || classify.isPending}
              className="w-full bg-emerald-700 text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/25 cursor-pointer text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">analytics</span>
              Analyser la récolte
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
