import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { aiClassifyHarvestMutation } from '@/features/harvests/api/harvests.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { Permission } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/harvests/analyze')({
  beforeLoad: () => {
    requireAuth(Permission.HARVEST_CREATE);
  },
  component: AnalyzePage,
});

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=600', // Soybeans
  'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600', // Corn field
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600', // Tomatoes
];

function AnalyzePage() {
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>(DEFAULT_IMAGES);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [classifiedData, setClassifiedData] = useState<any | null>(null);

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

  const handleAnalyze = () => {
    const activeImage = images[activeImageIndex];
    if (!activeImage) {
      addToast('Veuillez sélectionner une image à analyser.', 'warning');
      return;
    }
    const payload: { photoUrls: string[]; additionalNotes?: string } = {
      photoUrls: [activeImage],
    };
    if (additionalNotes) {
      payload.additionalNotes = additionalNotes;
    }
    classify.mutate(payload);
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) {
      addToast('Veuillez saisir une URL valide.', 'warning');
      return;
    }
    setImages((prev) => [...prev, newImageUrl.trim()]);
    setActiveImageIndex(images.length);
    setNewImageUrl('');
    setShowAddModal(false);
    addToast('Image ajoutée à la galerie.', 'success');
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
      {/* Immersive Background Image */}
      <div className="absolute inset-0 z-0 transition-all duration-500">
        <img
          alt="Récolte active"
          className="w-full h-full object-cover object-center transition-all duration-500"
          src={images[activeImageIndex]}
        />
        <div className="absolute inset-0 bg-black/40 z-1"></div>
      </div>

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

          {/* Horizontal Thumbnail List */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            {images.map((imgUrl, index) => {
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

            {/* Add Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-white/60">add</span>
            </button>
          </div>

          {/* Action Button */}
          <div className="pb-2">
            <button
              onClick={handleAnalyze}
              className="w-full bg-emerald-700 text-white font-bold py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/25 cursor-pointer text-xs uppercase tracking-wider"
            >
              <span className="material-symbols-outlined">analytics</span>
              Analyser la récolte
            </button>
          </div>
        </div>
      </footer>

      {/* Add Custom Image Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1c1c1e] border border-white/10 rounded-2xl w-full max-w-[360px] p-6 space-y-4 text-white">
            <h3 className="text-sm font-bold">Ajouter une image personnalisée</h3>
            <div className="space-y-1">
              <label className="text-[10px] text-white/60 block">URL de l'image</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white outline-none focus:border-emerald-500"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 text-xs">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-white/20 rounded-lg text-[11px] font-semibold hover:bg-white/5 cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleAddImage}
                className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-600 cursor-pointer"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
