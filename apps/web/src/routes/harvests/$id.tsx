import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHarvestDetailsQuery,
  getHarvestsByProductQuery,
  getDecayedPriceQuery,
} from '@/features/harvests/api/harvests.queries';
import { addBasketLineMutation } from '@/features/basket/api/basket.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { addToast } from '@/features/shared/store/toast.store';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import { formatCurrencyPrice } from '@/features/currency/store/currency.store';
import type { HarvestUnit, ProductCategory } from '@futurefarm/types';

export const Route = createFileRoute('/harvests/$id')({
  component: HarvestDetailPage,
});

const unitLabel = (unit?: HarvestUnit): string => {
  switch (unit) {
    case 'KG':
      return 'kg';
    case 'TON':
      return 'tonne';
    case 'PIECE':
      return 'pièce';
    default:
      return 'kg';
  }
};

const categoryToFrench = (category?: ProductCategory): string => {
  switch (category) {
    case 'VEGETABLES':
      return 'Maraîchage';
    case 'FRUITS':
      return 'Arboriculture';
    case 'CEREALS':
      return 'Grandes Cultures';
    case 'DATES':
      return 'Palmeraie';
    case 'DAIRY':
      return 'Élevage & Lait';
    case 'MEAT':
      return 'Élevage';
    default:
      return 'Maraîchage';
  }
};

const getVarietyTag = (productName?: string): string => {
  if (!productName) return 'Sélection';
  if (productName.toLowerCase().includes('tomate')) return 'Grappe';
  if (productName.toLowerCase().includes('pomme de terre')) return 'Chair ferme';
  if (productName.toLowerCase().includes('datte')) return 'Medjool';
  if (productName.toLowerCase().includes('mangue')) return 'Kent';
  if (productName.toLowerCase().includes('carotte')) return 'Nantaise';
  if (productName.toLowerCase().includes('maïs')) return 'Doux';
  if (productName.toLowerCase().includes('pomme')) return 'Gala';
  return 'Primeur';
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

  const productId = harvest?.productId;
  const { data: relatedBatches } = useQuery({
    ...getHarvestsByProductQuery(productId),
    enabled: !!productId,
  });

  // Gallery state
  const [activePhoto, setActivePhoto] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Add to basket mutation
  const addToBasket = useMutation({
    ...addBasketLineMutation(),
    onSuccess: () => {
      addToast('Produit ajouté au panier avec succès !', 'success');
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

  // Derived information & formats
  const photos = useMemo(() => {
    if (Array.isArray(harvest?.photoUrls) && harvest.photoUrls.length > 0) {
      return harvest.photoUrls;
    }
    return [
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
      'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800',
      'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800',
    ];
  }, [harvest?.photoUrls]);

  const currentPrice = Number(decayedPrice?.currentPrice ?? harvest?.pricePerUnit ?? 0);
  const unit = unitLabel(harvest?.unit as HarvestUnit);
  const qualityScore = Number(harvest?.qualityScore ?? 92);

  const harvestDateObj = useMemo(
    () => (harvest?.harvestDate ? new Date(harvest.harvestDate) : new Date()),
    [harvest?.harvestDate]
  );
  const expirationDateObj = useMemo(
    () => (harvest?.expirationDate ? new Date(harvest.expirationDate) : new Date()),
    [harvest?.expirationDate]
  );

  const harvestMonthYear = useMemo(() => {
    const str = harvestDateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [harvestDateObj]);

  const harvestMonthShort = useMemo(() => {
    const str = harvestDateObj.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [harvestDateObj]);

  const harvestFullDate = useMemo(() => {
    return harvestDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [harvestDateObj]);

  const expirationFullDate = useMemo(() => {
    return expirationDateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [expirationDateObj]);

  const freshnessLabel = useMemo(() => {
    const daysSince = (Date.now() - harvestDateObj.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 15) return 'Très frais';
    if (daysSince < 45) return 'Frais';
    return 'Conservé';
  }, [harvestDateObj]);

  const isCertifiedBio = useMemo(() => {
    const methods = harvest?.farmingMethods?.toLowerCase() ?? '';
    return methods.includes('bio') || methods.includes('biologique') || harvest?.farmerProfile?.isCertified === true;
  }, [harvest?.farmingMethods, harvest?.farmerProfile?.isCertified]);

  const isHVE = useMemo(() => {
    const methods = harvest?.farmingMethods?.toLowerCase() ?? '';
    return methods.includes('hve') || methods.includes('raisonnée') || methods.includes('permaculture');
  }, [harvest?.farmingMethods]);

  const distributionLocation = useMemo(() => {
    if (harvest?.parcel?.locationCoordinates) {
      return harvest.parcel.locationCoordinates;
    }
    if (harvest?.farmerProfile?.address) {
      return `${harvest.farmerProfile.address} - Plateforme Locale`;
    }
    return 'Silo Nord - Plateforme de Distribution 4';
  }, [harvest?.parcel?.locationCoordinates, harvest?.farmerProfile?.address]);

  const stockRatio = useMemo(() => {
    const inStock = Number(harvest?.quantityInStock ?? 0);
    const marge = Number(harvest?.stockMarge ?? 0);
    const total = inStock + marge;
    if (total <= 0) return 0;
    return Math.min(Math.round((inStock / total) * 100), 100);
  }, [harvest?.quantityInStock, harvest?.stockMarge]);

  // All batches list for "Autres récoltes disponibles"
  const allBatches = useMemo(() => {
    if (!relatedBatches || relatedBatches.length === 0) {
      if (harvest) return [harvest];
      return [];
    }
    return relatedBatches;
  }, [relatedBatches, harvest]);

  // ---------- Loading state ----------
  if (isLoading) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen font-sans">
        <BuyerHeader title="Détails Produit" showBack backTo="/marketplace" />
        <div className="max-w-[480px] mx-auto p-4 pt-20 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-10 h-10 border-4 border-[#0a3824] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#404941] text-sm font-semibold">Chargement des détails de la récolte...</p>
        </div>
      </div>
    );
  }

  // ---------- Error / not found ----------
  if (isError || !harvest) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen font-sans">
        <BuyerHeader title="Détails Produit" showBack backTo="/marketplace" />
        <div className="max-w-[480px] mx-auto p-4 pt-20">
          <div className="bg-white rounded-2xl border border-[#c0c9be] p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">error_outline</span>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-1">Récolte introuvable</h3>
            <p className="text-sm text-[#707970] mb-4">Cette récolte n'existe plus ou a été retirée du catalogue.</p>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0a3824] text-white rounded-xl text-sm font-semibold hover:bg-[#062618] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Retour au marché
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-32 font-sans">
      {/* ── Top Navigation Header ── */}
      <BuyerHeader
        title="Détails Produit"
        showBack
        backTo="/marketplace"
        rightAction={
          <Link
            to="/harvests/$id/quality"
            params={{ id }}
            className="p-2 text-[#404941] hover:text-[#0a3824] hover:bg-[#eff4ff] rounded-full transition-colors cursor-pointer shrink-0"
            title="Voir l'audit qualité complet"
            aria-label="Voir l'audit qualité complet"
          >
            <span className="material-symbols-outlined text-[22px]">more_vert</span>
          </Link>
        }
      />

      {/* ── Main Content Container ── */}
      <main className="pt-20 px-4 max-w-[480px] mx-auto flex flex-col gap-4">
        {/* ── 1. Image Gallery Card ── */}
        <section className="bg-white rounded-2xl border border-[#e2e8f0] p-3.5 shadow-sm">
          {/* Main preview */}
          <div className="relative h-[300px] w-full rounded-xl overflow-hidden bg-[#eff4ff]">
            <img
              className="w-full h-full object-cover transition-all duration-300"
              src={photos[activePhoto] ?? photos[0]}
              alt={harvest.product?.name ?? 'Photo produit'}
            />

            {/* Certifié Bio overlay badge */}
            {isCertifiedBio && (
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-[#0a3824] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md border border-gray-100">
                <span className="material-symbols-outlined text-[16px] text-[#0a3824]">verified</span>
                <span>Certifié Bio</span>
              </div>
            )}
          </div>

          {/* Thumbnails row */}
          {photos.length > 1 && (
            <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
              {photos.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhoto(idx)}
                  className={`h-20 w-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                    idx === activePhoto
                      ? 'border-[#0a3824] scale-[1.02] shadow-sm'
                      : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    className="w-full h-full object-cover"
                    src={url}
                    alt={`Miniature ${idx + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── 2. "Analyse IA de Qualité" Forest Green Banner ── */}
        <section className="bg-[#0a3824] text-white rounded-2xl p-5 shadow-sm">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[17px] font-bold tracking-tight text-white">Analyse IA de Qualité</h3>
              <p className="text-white/70 text-xs mt-0.5">Récolté en {harvestMonthYear}</p>
            </div>
            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#1a4a34] text-[#a7f3d0] border border-[#2d624a]">
              {freshnessLabel}
            </span>
          </div>

          {/* Body with circular score and bullet points */}
          <div className="flex items-center gap-5 mt-4 pt-1">
            {/* Circular score */}
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
              <span className="text-[22px] font-black text-[#0a3824]">{Math.round(qualityScore)}%</span>
            </div>

            {/* Feature bullets */}
            <div className="flex flex-col gap-2 text-xs text-white/90">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-white/80">calendar_today</span>
                <span>
                  Mois de récolte : <strong className="text-white font-semibold">{harvestMonthYear}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-white/80">layers</span>
                <span>
                  Récoltes disponibles : <strong className="text-white font-semibold">{Math.max(allBatches.length, 1)} lots</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-white/80">verified_user</span>
                <span>
                  <strong className="text-white font-semibold">
                    {isCertifiedBio ? 'Certifié Bio' : 'Agriculture Contrôlée'}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. "Description du produit" Card ── */}
        <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
          {/* Category & Variety pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#e0f2fe] text-[#0369a1]">
              {categoryToFrench(harvest.product?.category)}
            </span>
            <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-[#f1f5f9] text-[#475569]">
              {getVarietyTag(harvest.product?.name)}
            </span>
          </div>

          {/* Heading */}
          <h3 className="text-[16px] font-bold text-[#0a3824] mb-2.5">Description du produit</h3>

          {/* Description body */}
          <p className="text-[13px] text-gray-600 leading-relaxed mb-5">
            {harvest.product?.description ||
              "Produit cultivé selon des méthodes traditionnelles respectueuses de l'environnement au cœur de la vallée. Récolté à pleine maturité pour garantir une saveur et une fraîcheur optimales."}
          </p>

          {/* Two-column metadata */}
          <div className="grid grid-cols-2 gap-4 pt-1 mb-5">
            {/* Column 1: Méthodes & Certifications */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                MÉTHODES & CERTIFICATIONS
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#eaf5ee] text-[#14532d] rounded-lg border border-[#bbf7d0] text-xs font-bold w-fit">
                  <span className="material-symbols-outlined text-[15px]">eco</span>
                  <span>Agriculture Bio</span>
                </div>
                {isHVE && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#fef3c7] text-[#92400e] rounded-lg border border-[#fde68a] text-xs font-bold w-fit">
                    <span className="material-symbols-outlined text-[15px]">shield</span>
                    <span>HVE</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Dates Clés */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">DATES CLÉS</p>
              <div className="text-xs text-gray-700 flex flex-col gap-1.5">
                <p>
                  Récolte : <span className="font-bold text-gray-900">{harvestFullDate}</span>
                </p>
                <p>
                  Expiration : <span className="font-bold text-gray-900">{expirationFullDate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Location banner */}
          <div className="bg-[#f8f9fc] border border-[#e2e8f0] rounded-xl p-3 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-[#9a3412] mt-0.5 shrink-0">
              location_on
            </span>
            <p className="text-xs text-gray-700 leading-snug">
              Disponible à: <span className="font-medium text-gray-900">{distributionLocation}</span>
            </p>
          </div>
        </section>

        {/* ── 4. "Stock & Tarification" Card ── */}
        <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-[#0a3824]">Stock & Tarification</h3>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#fef3c7] text-[#92400e]">
              {harvest.priceDecayConfig ? 'Prix dégressif' : 'Prix fixe'}
            </span>
          </div>

          {/* Stock row */}
          <div className="flex justify-between items-center text-xs text-gray-500 font-medium mt-3.5 mb-1.5">
            <span>Quantité disponible</span>
            <span className="text-sm font-bold text-[#0a3824]">
              {harvest.quantityInStock} {unit} restants
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0a3824] rounded-full transition-all duration-700"
              style={{ width: `${stockRatio}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Stock de la récolte {harvestMonthShort}</p>

          {/* Price section */}
          <div className="mt-4 pt-3.5 border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              PRIX DE VENTE ACTUEL
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-black text-[#0a3824]">
                {formatCurrencyPrice(currentPrice, harvest.currency || 'CDF')}
              </span>
              <span className="text-xs text-gray-500 font-medium">/ {unit}</span>
            </div>
          </div>
        </section>

        {/* ── 5. "Autres récoltes disponibles" Card ── */}
        <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
          <h3 className="text-[15px] font-bold text-[#0a3824] mb-3">Autres récoltes disponibles</h3>

          <div className="flex flex-col gap-2.5">
            {allBatches.map((batch) => {
              const isCurrent = batch.id === id;
              const isExhausted = Number(batch.quantityInStock) <= 0;
              const batchDate = new Date(batch.harvestDate);
              const batchMonth =
                batchDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
              const batchMonthFormatted = batchMonth.charAt(0).toUpperCase() + batchMonth.slice(1);
              const batchScore = Math.round(Number(batch.qualityScore ?? 90));
              const batchPrice = Number(batch.pricePerUnit);

              return (
                <div
                  key={batch.id}
                  onClick={() => {
                    if (!isCurrent) {
                      void navigate({ to: `/harvests/${batch.id}` as any });
                    }
                  }}
                  className={`rounded-xl p-3.5 transition-all ${
                    isCurrent
                      ? 'border-2 border-[#0a3824] bg-white shadow-sm'
                      : `border border-gray-200 hover:border-gray-300 bg-white cursor-pointer ${
                          isExhausted ? 'opacity-65 bg-gray-50/70' : ''
                        }`
                  }`}
                >
                  {/* Top row */}
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isExhausted ? 'bg-gray-300' : 'bg-[#10b981]'
                        }`}
                      />
                      <span className="font-bold text-xs text-gray-900">{batchMonthFormatted}</span>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isExhausted ? 'text-gray-400' : 'text-[#0a3824]'
                      }`}
                    >
                      {batchScore}%
                    </span>
                  </div>

                  {/* Details row */}
                  <div className="flex justify-between items-baseline text-xs text-gray-600 mb-1">
                    <span>{batch.quantityInStock}kg restants</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrencyPrice(batchPrice, batch.currency || 'CDF')}/{unitLabel(batch.unit as HarvestUnit)}
                    </span>
                  </div>

                  {/* Status pill */}
                  <div>
                    {isExhausted ? (
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        ÉPUISÉ
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-[#10b981] uppercase tracking-wider">
                        DISPONIBLE
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── Fixed Bottom Action Bar ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 p-3.5 z-50 flex items-center gap-3 shadow-lg">
        {/* Quantity Stepper Control */}
        <div className="flex items-center border border-gray-200 bg-[#f8f9fc] rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || Number(harvest.quantityInStock) <= 0}
            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
            aria-label="Diminuer la quantité"
          >
            <span className="material-symbols-outlined text-[18px] text-[#0a3824]">remove</span>
          </button>
          <span className="w-10 text-center font-bold text-sm text-[#0b1c30]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(Number(harvest.quantityInStock), q + 1))}
            disabled={quantity >= Number(harvest.quantityInStock) || Number(harvest.quantityInStock) <= 0}
            className="w-9 h-9 rounded-lg bg-white flex items-center justify-center cursor-pointer hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
            aria-label="Augmenter la quantité"
          >
            <span className="material-symbols-outlined text-[18px] text-[#0a3824]">add</span>
          </button>
        </div>

        {/* Ajouter au panier Button with Quantity & Total Price */}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={addToBasket.isPending || Number(harvest.quantityInStock) <= 0}
            className="flex-1 py-3 px-4 bg-[#0a3824] hover:bg-[#062618] active:bg-[#03160e] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-md flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[20px] shrink-0">shopping_cart</span>
              <span className="truncate">
                {addToBasket.isPending ? 'Ajout...' : `Ajouter (${quantity} ${unit})`}
              </span>
            </div>
            <span className="shrink-0 text-xs bg-[#1a4a34] px-2.5 py-1 rounded-lg text-[#a7f3d0] font-bold">
              {formatCurrencyPrice(currentPrice * quantity, harvest.currency || 'CDF')}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate({ to: '/auth/login', search: { redirect: `/harvests/${id}` } })}
            className="flex-1 py-3 px-4 bg-[#0a3824] hover:bg-[#062618] active:bg-[#03160e] text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-md flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[20px] shrink-0">login</span>
              <span className="truncate">Se connecter</span>
            </div>
            <span className="shrink-0 text-xs bg-[#1a4a34] px-2.5 py-1 rounded-lg text-[#a7f3d0] font-bold">
              {formatCurrencyPrice(currentPrice * quantity, harvest.currency || 'CDF')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
