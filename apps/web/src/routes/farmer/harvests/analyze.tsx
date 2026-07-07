import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/harvests/analyze')({
  component: AnalyzePage,
});

const IMAGES = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCg0rJut_1T49ULPWoBVV58fFogWi4JwEhDvgmLH9TOk78C2BU9sLCmTXXwPWxqBxCakhOwfjJOXs66-4JqyUU5u1p5yrZbvUoVahvDkHwFvNyne4EQcbVaYY0EIS8r7EGzkAKUc846XC0FPlGsAFfcP-jOFxSwIgJL6jDrsLBc6dYqNTLtyBA23mA9CM0X62eW3c84CJ5tpIIX5-vXv7KQBIlY73VboFjnA8Isotq_gFhdOERQ9BAyi50YlBuCDcGTO2IZUjZrnb8',
  'https://images.unsplash.com/photo-1590779033100-9f60705a2f3b?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1498579687545-d5a4fffb0a9e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600',
];

function AnalyzePage() {
  const navigate = useNavigate();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisResult(
        'Analyse terminée avec succès ! Qualité estimée : 94% (Grade A). Aucun défaut majeur détecté.'
      );
    }, 2000);
  };

  return (
    <div className="bg-black text-white min-h-screen overflow-hidden select-none relative">
      {/* Immersive Background Image */}
      <div className="absolute inset-0 z-0 transition-all duration-500">
        <img
          alt="Récolte active"
          className="w-full h-full object-cover object-center transition-all duration-500"
          src={IMAGES[activeImageIndex]}
        />
        <div className="absolute inset-0 bg-black/35 z-1"></div>
      </div>

      {/* Top Action: Close Button */}
      <header className="absolute top-0 left-0 w-full z-50 p-4 pt-6">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              void navigate({ to: '/farmer/dashboard' });
            } else {
              void navigate({ to: '/farmer/dashboard' });
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full text-white active:scale-95 transition-transform cursor-pointer border border-white/10"
        >
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
      </header>

      {/* Analysis Loading / Result Overlay */}
      {(isAnalyzing || analysisResult) && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          {isAnalyzing ? (
            <div className="space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm font-semibold tracking-wide">Analyse IA de la qualité en cours...</p>
            </div>
          ) : (
            <div className="space-y-6 max-w-md bg-white text-on-surface p-6 rounded-2xl shadow-xl">
              <span className="material-symbols-outlined text-primary text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <h3 className="font-display text-lg font-bold text-[#1C1C1C]">Rapport d'Analyse IA</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {analysisResult}
              </p>
              <button
                onClick={() => setAnalysisResult(null)}
                className="w-full bg-primary text-white font-semibold py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom Bar (WhatsApp Story Style) */}
      <footer className="absolute bottom-0 left-0 w-full z-30 bg-black/85 backdrop-blur-xl border-t border-white/10 pb-8">
        <div className="p-4 space-y-6 max-w-[480px] mx-auto">
          {/* Horizontal Thumbnail List */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            {IMAGES.map((imgUrl, index) => {
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
              onClick={() => alert('Ajouter une image')}
              className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-white/40 flex items-center justify-center bg-white/5 active:scale-95 transition-transform cursor-pointer"
            >
              <span className="material-symbols-outlined text-white/60">add</span>
            </button>
          </div>

          {/* Action Button */}
          <div className="pb-2">
            <button
              onClick={handleAnalyze}
              className="w-full bg-primary text-white font-semibold py-4 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer"
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
