import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHarvestDetailsQuery, getDecayedPriceQuery } from '@/features/harvests/api/harvests.queries';
import { addBasketLineMutation } from '@/features/basket/api/basket.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { addToast } from '@/features/shared/store/toast.store';
import type { HarvestUnit } from '@futurefarm/types';

export const Route = createFileRoute('/harvests/$id')({
  component: HarvestDetailPage,
});

const unitLabel = (unit: HarvestUnit): string => {
  switch (unit) {
    case 'KG':
      return 'kg';
    case 'TON':
      return 'tonne';
    case 'PIECE':
      return 'pièce';
    default:
      return unit;
  }
};

function HarvestDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Queries
  const { data: harvest, isLoading, isError } = useQuery(getHarvestDetailsQuery(id));
  const { data: decayedPrice } = useQuery({
    ...getDecayedPriceQuery(id),
    enabled: !!harvest?.priceDecayConfig,
  });

  // Gallery state
  const [activePhoto, setActivePhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Quality gauge animation
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

  // Add to basket mutation
  const addToBasket = useMutation({
    ...addBasketLineMutation(),
    onSuccess: () => {
      addToast('Produit ajouté au panier !', 'success');
      void queryClient.invalidateQueries({ queryKey: ['basket'] });
    },
    onError: () => {
      addToast("Erreur lors de l'ajout au panier", 'error');
    },
  });

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      addToast('Veuillez vous connecter pour ajouter au panier.', 'warning');
      void navigate({ to: '/auth/login', search: { redirect: `/harvests/${id}` } });
      return;
    }
    addToBasket.mutate({ harvestId: id, quantity });
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
          <Link to="/marketplace" className="flex items-center gap-2 text-[#004322] mb-6">
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="font-bold text-sm">Retour au marché</span>
          </Link>
          <div className="bg-white rounded-xl border border-[#c0c9be] p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">error_outline</span>
            <p className="text-[#404941] font-semibold">Récolte introuvable</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Derived data ----------
  const photos = harvest.photoUrls.length > 0 ? harvest.photoUrls : [];
  const currentPrice = decayedPrice?.currentPrice ?? harvest.pricePerUnit;
  const originalPrice = decayedPrice?.originalPrice;
  const hasDiscount = originalPrice !== undefined && currentPrice < originalPrice;
  const unit = unitLabel(harvest.unit as HarvestUnit);

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-32 font-sans">
      {/* ── Fixed Header ── */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex items-center justify-between px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/marketplace" className="material-symbols-outlined text-[#004322] cursor-pointer shrink-0">
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322] truncate">
            {harvest.product?.name ?? 'Détail Récolte'}
          </h1>
        </div>
        <Link
          to="/harvests/$id/quality"
          params={{ id }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#eff4ff] transition-colors cursor-pointer shrink-0"
          title="Voir les métriques qualité"
        >
          <span className="material-symbols-outlined text-[#404941]">analytics</span>
        </Link>
      </header>

      {/* ── Main Content ── */}
      <main className="pt-20 px-4 max-w-[480px] mx-auto flex flex-col gap-4">
        {/* ── Image Gallery ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-3 shadow-sm">
          <div className="relative h-[280px] w-full rounded-lg overflow-hidden mb-3 bg-[#eff4ff]">
            {photos.length > 0 ? (
              <img
                className="w-full h-full object-cover"
                src={photos[activePhoto]}
                alt={harvest.product?.name ?? 'Photo produit'}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[#707970] text-[48px]">image</span>
              </div>
            )}
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-red-500 text-white px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-md">
                <span className="material-symbols-outlined text-[16px]">local_offer</span>
                -{Math.round((1 - currentPrice / originalPrice!) * 100)}%
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhoto(idx)}
                  className={`h-16 w-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                    idx === activePhoto
                      ? 'border-[#1a5c35] scale-105 shadow-sm'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img className="w-full h-full object-cover" src={url} alt={`Miniature ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Product Info ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3 gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-[#0b1c30]">{harvest.product?.name ?? 'Produit'}</h2>
              {harvest.product?.category && (
                <span className="text-[12px] text-[#707970] font-medium">{harvest.product.category}</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-[#1a5c35]">
                {currentPrice.toFixed(2)}{' '}
                <span className="text-sm font-medium">€/{unit}</span>
              </div>
              {hasDiscount && (
                <span className="text-[12px] text-[#707970] line-through">
                  {originalPrice!.toFixed(2)} €
                </span>
              )}
            </div>
          </div>

          {/* Product description */}
          {harvest.product?.description && (
            <p className="text-[13px] text-[#404941] leading-relaxed mb-3">
              {harvest.product.description}
            </p>
          )}

          {/* Farming method */}
          {harvest.farmingMethods && (
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="flex items-center gap-1 px-2.5 py-1 bg-[#E6F3EA] text-[#1A5C35] rounded-lg border border-[#1A5C35]/20 text-[11px] font-bold">
                <span className="material-symbols-outlined text-[16px]">eco</span>
                {harvest.farmingMethods}
              </span>
            </div>
          )}

          {/* Key dates */}
          <div className="grid grid-cols-2 gap-3 border-t border-[#c0c9be]/40 pt-3">
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-bold tracking-wider">Récolte</p>
              <p className="text-[13px] font-semibold">
                {new Date(harvest.harvestDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-bold tracking-wider">Expiration</p>
              <p className="text-[13px] font-semibold">
                {new Date(harvest.expirationDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </section>

        {/* ── Stock & Quantity ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-4 shadow-sm">
          <h3 className="text-[11px] text-[#004322] uppercase font-bold tracking-wider mb-3">
            Stock disponible
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#0b1c30]">
                  {harvest.quantityInStock}
                </span>
                <span className="text-sm text-[#707970]">{unit}</span>
              </div>
            </div>
            <div className="w-24 h-2.5 bg-[#eff4ff] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a5c35] rounded-full transition-all duration-1000"
                style={{
                  width: `${Math.min(
                    (harvest.quantityInStock / (harvest.quantityInStock + harvest.stockMarge)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#c0c9be]/40">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 rounded-full bg-[#eff4ff] flex items-center justify-center cursor-pointer hover:bg-[#dce9ff] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#004322]">remove</span>
              </button>
              <span className="w-10 text-center font-bold text-[16px]">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(harvest.quantityInStock, quantity + 1))}
                className="w-9 h-9 rounded-full bg-[#eff4ff] flex items-center justify-center cursor-pointer hover:bg-[#dce9ff] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[#004322]">add</span>
              </button>
            </div>
            <p className="text-[13px] text-[#707970]">
              Total:{' '}
              <span className="font-bold text-[#1a5c35]">
                {(currentPrice * quantity).toFixed(2)} €
              </span>
            </p>
          </div>
        </section>

        {/* ── Quality Score Gauge (like farmer dashboard) ── */}
        {qualityScore !== null && (
          <Link to="/harvests/$id/quality" params={{ id }}>
            <section className="bg-[#1a5c35] text-white rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold">Score Qualité</h3>
                  <p className="text-white/70 text-xs">Analyse IA</p>
                </div>
                <span className="material-symbols-outlined text-white/70">chevron_right</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Circular gauge */}
                <div
                  className="relative w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `conic-gradient(#aef2be ${gaugeScore * 3.6}deg, rgba(255, 255, 255, 0.15) 0)`,
                  }}
                >
                  <div className="w-[68px] h-[68px] rounded-full bg-[#1a5c35] flex items-center justify-center">
                    <span className="text-lg font-black text-white">{gaugeScore}%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/80">
                    {gaugeScore >= 80
                      ? 'Qualité excellente'
                      : gaugeScore >= 60
                      ? 'Bonne qualité'
                      : 'Qualité moyenne'}
                  </p>
                  <span className="text-xs text-[#aef2be] font-semibold mt-1 inline-block">
                    Voir les détails →
                  </span>
                </div>
              </div>
            </section>
          </Link>
        )}

        {/* ── Price Decay Info ── */}
        {hasDiscount && harvest.priceDecayConfig && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 shadow-sm">
            <span className="material-symbols-outlined text-amber-600 text-[20px]">local_offer</span>
            <div className="text-[12px] text-amber-900">
              <p className="font-semibold">
                Prix réduit — {Math.round((1 - currentPrice / originalPrice!) * 100)}% de remise
              </p>
              <p className="text-amber-700">
                {harvest.priceDecayConfig.decaySteps.length} palier(s) de dégressivité
              </p>
            </div>
          </section>
        )}

        {/* ── Farmer Info ── */}
        <section className="bg-white rounded-xl border border-[#c0c9be] p-4 shadow-sm">
          <h3 className="text-[11px] text-[#004322] uppercase font-bold tracking-wider mb-2">
            Producteur
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a5c35] flex items-center justify-center text-white font-bold">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[#0b1c30]">ID: {harvest.farmerProfileId}</p>
              <p className="text-[12px] text-[#707970]">Producteur local</p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Fixed Bottom: Add to cart ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-[#c0c9be] p-4 z-50">
        {isAuthenticated ? (
          <button
            onClick={handleAddToCart}
            disabled={addToBasket.isPending}
            className="w-full py-3 bg-[#1a5c35] text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-[#004322] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <span className="material-symbols-outlined">shopping_cart</span>
            {addToBasket.isPending ? 'Ajout en cours...' : 'Ajouter au panier'}
          </button>
        ) : (
          <button
            onClick={() => navigate({ to: '/auth/login', search: { redirect: `/harvests/${id}` } })}
            className="w-full py-3 bg-[#1a5c35] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <span className="material-symbols-outlined">login</span>
            Se connecter pour acheter
          </button>
        )}
      </div>
    </div>
  );
}
