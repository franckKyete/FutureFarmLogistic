import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHarvestDetailsQuery } from '@/features/harvests/api/harvests.queries';

export const Route = createFileRoute('/harvests/$id/quality')({
  component: HarvestQualityPage,
});

function HarvestQualityPage() {
  const { id } = Route.useParams();

  const { data: harvest, isLoading, isError } = useQuery(getHarvestDetailsQuery(id));

  // Gauge animation
  const [gaugeScore, setGaugeScore] = useState(0);
  const qualityScore = harvest?.qualityScore ?? null;

  useEffect(() => {
    if (qualityScore === null) return;
    const target = Math.round(qualityScore);
    if (target === 0) return;
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      setGaugeScore(current);
    }, 15);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityScore]);

  // SVG gauge config (static for the large gauge)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const score = qualityScore !== null ? Math.round(qualityScore) : 0;
  const strokeDashoffset = circumference * (1 - score / 100);

  const getScoreLabel = (s: number): string => {
    if (s >= 90) return 'Exceptionnel';
    if (s >= 80) return 'Excellente';
    if (s >= 70) return 'Très bonne';
    if (s >= 60) return 'Bonne';
    if (s >= 40) return 'Moyenne';
    return 'Faible';
  };

  const getScoreColor = (s: number): string => {
    if (s >= 80) return '#1a5c35';
    if (s >= 60) return '#5c8a1a';
    if (s >= 40) return '#b8860b';
    return '#c0392b';
  };

  // ---------- Loading state ----------
  if (isLoading) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen font-sans">
        <div className="max-w-[480px] mx-auto p-4 pt-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-[#1a5c35] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#404941] text-sm font-semibold">Chargement...</p>
        </div>
      </div>
    );
  }

  // ---------- Error / not found ----------
  if (isError || !harvest) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen font-sans">
        <div className="max-w-[480px] mx-auto p-4 pt-20">
          <Link to="/harvests/$id" params={{ id }} className="flex items-center gap-2 text-[#004322] mb-6">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-bold text-sm">Retour au produit</span>
          </Link>
          <div className="bg-white rounded-xl border border-[#c0c9be] p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">error_outline</span>
            <p className="text-[#404941] font-semibold">Récolte introuvable</p>
          </div>
        </div>
      </div>
    );
  }

  const scoreColor = qualityScore !== null ? getScoreColor(qualityScore) : '#707970';
  const scoreLabel = qualityScore !== null ? getScoreLabel(qualityScore) : 'Non disponible';

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* ── Fixed Header ── */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex items-center justify-between px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/harvests/$id"
            params={{ id }}
            className="material-symbols-outlined text-[#004322] cursor-pointer shrink-0"
          >
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322] truncate">
            Qualité — {harvest.product?.name ?? 'Produit'}
          </h1>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="pt-20 px-4 max-w-[480px] mx-auto flex flex-col gap-4">
        {/* ── Quality Gauge ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-6 shadow-sm text-center">
          {qualityScore !== null ? (
            <>
              <h2 className="text-[12px] font-bold text-[#004322] uppercase tracking-wider mb-4">
                Score Qualité
              </h2>
              {/* SVG Circular Gauge */}
              <div className="flex justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      fill="transparent"
                      r={radius}
                      stroke="#E5E7EB"
                      strokeWidth="8"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      fill="transparent"
                      r={radius}
                      stroke={scoreColor}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="drop-shadow-sm transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-bold" style={{ color: scoreColor }}>
                      {gaugeScore}
                    </span>
                    <span className="text-[11px] text-[#707970] font-semibold">/ 100</span>
                  </div>
                </div>
              </div>

              {/* Score interpretation */}
              <p className="text-[13px] font-bold text-[#0b1c30] mb-3">{scoreLabel}</p>
              <div className="grid grid-cols-5 gap-1 mb-4">
                {[20, 40, 60, 80, 100].map((threshold) => (
                  <div key={threshold} className="text-center">
                    <div
                      className={`h-1.5 rounded-full mb-1 ${
                        qualityScore >= threshold ? 'bg-[#1a5c35]' : 'bg-[#eff4ff]'
                      }`}
                    />
                    <span className="text-[9px] text-[#707970] font-semibold">{threshold}</span>
                  </div>
                ))}
              </div>

              <p className="text-[13px] text-[#404941] leading-relaxed">
                {qualityScore >= 80
                  ? 'Ce produit présente une qualité exceptionnelle, répondant aux plus hauts standards.'
                  : qualityScore >= 60
                  ? 'Ce produit est de bonne qualité, conforme aux attentes.'
                  : qualityScore >= 40
                  ? 'Ce produit est de qualité moyenne. Des améliorations sont possibles.'
                  : 'La qualité de ce produit est faible. Une attention particulière est recommandée.'}
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full bg-[#eff4ff] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#707970] text-[48px]">
                    science
                  </span>
                </div>
              </div>
              <h2 className="text-lg font-bold text-[#0b1c30] mb-2">
                Analyse qualité non disponible
              </h2>
              <p className="text-[13px] text-[#404941] leading-relaxed">
                Aucune donnée qualité n&apos;est encore disponible pour cette récolte.
                Veuillez réessayer ultérieurement.
              </p>
            </>
          )}
        </section>

        {/* ── Lab Analysis Info ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-4 shadow-sm">
          <h3 className="text-[11px] text-[#004322] uppercase font-bold tracking-wider mb-3">
            Analyse en laboratoire
          </h3>
          {qualityScore !== null ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-[#eff4ff] rounded-lg">
                <span className="material-symbols-outlined text-[#1a5c35]">lab_research</span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#0b1c30]">Analyse organoleptique</p>
                  <p className="text-[11px] text-[#707970]">
                    Effectuée le {new Date(harvest.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-[#1a5c35] bg-white px-2 py-0.5 rounded-full">
                  Conforme
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#eff4ff] rounded-lg">
                <span className="material-symbols-outlined text-[#1a5c35]">science</span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#0b1c30]">Analyse physico-chimique</p>
                  <p className="text-[11px] text-[#707970]">Résultats disponibles</p>
                </div>
                <span className="text-[11px] font-bold text-[#1a5c35] bg-white px-2 py-0.5 rounded-full">
                  {qualityScore >= 60 ? 'Favorable' : 'À revoir'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-[#707970] text-[36px] mb-2 block">
                pending
              </span>
              <p className="text-[13px] text-[#404941]">
                Aucune analyse en laboratoire disponible pour cette récolte.
              </p>
            </div>
          )}
        </section>

        {/* ── Certifications & Labels ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-4 shadow-sm">
          <h3 className="text-[11px] text-[#004322] uppercase font-bold tracking-wider mb-3">
            Certifications & Labels
          </h3>
          {harvest.farmingMethods ? (
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 px-3 py-2 bg-[#E6F3EA] text-[#1A5C35] rounded-lg border border-[#1A5C35]/20 text-[12px] font-bold">
                <span className="material-symbols-outlined text-[18px]">eco</span>
                {harvest.farmingMethods}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-2 bg-[#FFF8E6] text-[#885200] rounded-lg border border-[#885200]/20 text-[12px] font-bold">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                Agriculture durable
              </span>
              {qualityScore !== null && qualityScore >= 70 && (
                <span className="flex items-center gap-1.5 px-3 py-2 bg-[#E8F5E9] text-[#2E7D32] rounded-lg border border-[#2E7D32]/20 text-[12px] font-bold">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  Qualité certifiée
                </span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[#404941]">
              Aucune certification renseignée pour cette récolte.
            </p>
          )}
        </section>

        {/* ── Product Summary ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-4 shadow-sm">
          <h3 className="text-[11px] text-[#004322] uppercase font-bold tracking-wider mb-3">
            Résumé du produit
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#eff4ff] shrink-0">
              {harvest.photoUrls?.[0] ? (
                <img
                  className="w-full h-full object-cover"
                  src={harvest.photoUrls[0]}
                  alt={harvest.product?.name ?? ''}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#707970]">image</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0b1c30] truncate">
                {harvest.product?.name ?? 'Produit'}
              </p>
              <p className="text-[12px] text-[#707970]">
                {harvest.pricePerUnit.toFixed(2)} € /{' '}
                {harvest.unit === 'KG' ? 'kg' : harvest.unit === 'TON' ? 'tonne' : 'pièce'}
              </p>
            </div>
            <Link
              to="/harvests/$id"
              params={{ id }}
              className="text-[12px] font-bold text-[#1a5c35] hover:underline shrink-0"
            >
              Voir le produit
            </Link>
          </div>
        </section>

        {/* ── Back Link ── */}
        <Link
          to="/harvests/$id"
          params={{ id }}
          className="flex items-center justify-center gap-2 py-3 text-[#004322] font-bold text-sm rounded-xl border border-[#c0c9be] bg-white hover:bg-[#eff4ff] transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Retour au produit
        </Link>
      </main>
    </div>
  );
}
