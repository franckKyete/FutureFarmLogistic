import { Icon } from '@/features/shared/components/Icon';
import { useState } from 'react';

export interface PhotoGuidanceBannerProps {
  photoCount: number;
  minRequired?: number;
  className?: string;
  variant?: 'dark' | 'light';
}

export const PHOTO_ANGLE_TIPS = [
  {
    id: 'overview',
    title: 'Vue d\'ensemble du lot',
    desc: 'Caisse ou tas complet pour évaluer l\'homogénéité globale',
    icon: 'grid_view',
  },
  {
    id: 'texture',
    title: 'Gros plan texture & peau',
    desc: 'Surface nette pour vérifier le grain, la fermeté et l\'aspect',
    icon: 'zoom_in',
  },
  {
    id: 'stem',
    title: 'Pédoncule / Tige',
    desc: 'Point d\'attache vert ou cicatrice pour apprécier la fraîcheur de cueillette',
    icon: 'eco',
  },
  {
    id: 'top',
    title: 'Face supérieure',
    desc: 'Vue plongeante du dessus du légume / fruit',
    icon: 'arrow_upward',
  },
  {
    id: 'bottom',
    title: 'Face inférieure / Base',
    desc: 'Vue du dessous pour détecter d\'éventuelles traces de pourriture de fond',
    icon: 'arrow_downward',
  },
  {
    id: 'profile_left',
    title: 'Profil latéral gauche',
    desc: 'Vue de profil pour apprécier le calibre et la rectitude',
    icon: 'chevron_left',
  },
  {
    id: 'profile_right',
    title: 'Profil latéral droit',
    desc: 'Vue latérale opposée pour un diagnostic à 360°',
    icon: 'chevron_right',
  },
  {
    id: 'lighting',
    title: 'Éclairage naturel régulier',
    desc: 'Lumière du jour sans reflets directs ni zones sombres',
    icon: 'lightbulb',
  },
  {
    id: 'defects',
    title: 'Défauts & imperfections éventuels',
    desc: 'Zone présentant une tache ou un impact pour calibrer le score qualité',
    icon: 'warning',
  },
  {
    id: 'cross_section',
    title: 'Coupe ou groupe représentatif',
    desc: 'Section ouverte ou échantillon de 3 à 5 pièces juxtaposées',
    icon: 'content_cut',
  },
];

export function PhotoGuidanceBanner({
  photoCount,
  minRequired = 10,
  className = '',
  variant = 'dark',
}: PhotoGuidanceBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isComplete = photoCount >= minRequired;
  const progressPercent = Math.min(100, Math.round((photoCount / minRequired) * 100));

  const isDark = variant === 'dark';

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isDark
          ? 'bg-black/60 backdrop-blur-md border-white/15 text-white'
          : 'bg-[#f0f9f4] border-[#c0c9be] text-[#0b1c30]'
      } ${className}`}
    >
      {/* Header section with progress indicator */}
      <div className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isComplete
                  ? 'bg-emerald-500 text-white'
                  : isDark
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              <Icon
                name={isComplete ? 'check_circle' : 'photo_camera'}
                className="text-base"
              />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold tracking-tight">
                {isComplete
                  ? 'Condition photo validée (10/10+)'
                  : `Photos requises pour l'analyse IA (${photoCount}/${minRequired})`}
              </h4>
              <p
                className={`text-[11px] ${
                  isDark ? 'text-white/70' : 'text-[#404941]'
                }`}
              >
                {isComplete
                  ? 'Nombre de photos suffisant pour une classification et notation fiables.'
                  : `Ajoutez encore au moins ${minRequired - photoCount} photo(s) sous différents angles.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-white hover:bg-slate-100 text-[#004322] border border-[#c0c9be]'
            }`}
          >
            <span>{isExpanded ? 'Masquer le guide' : 'Guide des angles'}</span>
            <Icon
              name={isExpanded ? 'expand_less' : 'expand_more'}
              className="text-sm"
            />
          </button>
        </div>

        {/* Progress bar */}
        <div
          className={`w-full h-2 rounded-full overflow-hidden ${
            isDark ? 'bg-white/10' : 'bg-gray-200'
          }`}
        >
          <div
            className={`h-full transition-all duration-300 ${
              isComplete
                ? 'bg-emerald-500'
                : progressPercent > 50
                  ? 'bg-emerald-400'
                  : 'bg-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Collapsible Angle & Quality Tips List */}
      {isExpanded && (
        <div
          className={`p-3.5 sm:p-4 border-t text-xs ${
            isDark
              ? 'border-white/10 bg-black/40'
              : 'border-[#c0c9be] bg-white/70'
          }`}
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-500 flex items-center gap-1">
              <Icon name="tips_and_updates" className="text-sm" />
              10 Angles et prises de vue recommandés pour l'IA
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PHOTO_ANGLE_TIPS.map((tip, idx) => (
              <div
                key={tip.id}
                className={`p-2.5 rounded-xl flex items-start gap-2.5 transition-all ${
                  isDark
                    ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                    : 'bg-white border border-[#e0e5df] hover:border-emerald-300'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    idx < photoCount
                      ? 'bg-emerald-500 text-white'
                      : isDark
                        ? 'bg-white/10 text-white/60'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {idx < photoCount ? '✓' : idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-[11px] flex items-center gap-1 truncate">
                    <Icon name={tip.icon} className="text-xs text-emerald-400" />
                    <span>{tip.title}</span>
                  </div>
                  <p
                    className={`text-[10px] line-clamp-2 mt-0.5 leading-tight ${
                      isDark ? 'text-white/60' : 'text-gray-600'
                    }`}
                  >
                    {tip.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`mt-3 p-2.5 rounded-xl flex items-center gap-2 text-[10px] ${
              isDark
                ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-800/40'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
            }`}
          >
            <Icon name="info" className="text-sm text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Astuce :</strong> Plus les angles sont variés et représentatifs de l'état réel de votre récolte, plus la précision de classification et la note attribuée par le modèle seront élevées.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
