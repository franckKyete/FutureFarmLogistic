import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProductsQuery,
  createProductMutation,
  createHarvestMutation,
  aiSuggestHarvestMutation,
} from '@/features/harvests/api/harvests.queries';
import {
  refreshOfflineQueueState,
  useOfflineSyncState,
  saveTempDraft,
  getTempDraft,
  deleteTempDraft,
  type OfflineHarvestDraft,
} from '@/features/harvests/offline';
import { HarvestPhotoPicker } from '@/features/harvests/components/HarvestPhotoPicker';
import { addToast } from '@/features/shared/store/toast.store';
import { apiClient } from '@/lib/api-client';
import { dataUrlToFile } from '@/features/harvests/offline/offline-sync.service';
import { HarvestUnit, ProductCategory } from '@futurefarm/types';

export interface HarvestFormSearchParams {
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
  reviewDraftId?: string | undefined;
  farmerUserId?: string | undefined;
  farmerName?: string | undefined;
}

export interface HarvestFormViewProps {
  searchParams: HarvestFormSearchParams;
  onNavigateBack: () => void;
  onSuccessRedirect: () => void;
  isProxy?: boolean | undefined;
  farmerUserId?: string | undefined;
  farmerName?: string | undefined;
}

export function HarvestFormView({
  searchParams,
  onNavigateBack,
  onSuccessRedirect,
  isProxy = false,
  farmerUserId: propFarmerUserId,
  farmerName: propFarmerName,
}: HarvestFormViewProps) {
  const queryClient = useQueryClient();
  const { isOnline } = useOfflineSyncState();

  const effectiveFarmerUserId = propFarmerUserId || searchParams.farmerUserId;
  const effectiveFarmerName = propFarmerName || searchParams.farmerName;

  // Form states initialized with search params if present (from AI analysis)
  const [productId, setProductId] = useState(searchParams.productId || '');
  const [isCustomCrop, setIsCustomCrop] = useState(
    searchParams.isIdentified === 'false' || (!searchParams.productId && searchParams.isIdentified !== 'true'),
  );
  const [newCropName, setNewCropName] = useState('');
  const [newCropCategory, setNewCropCategory] = useState<ProductCategory>(ProductCategory.VEGETABLES);
  const [newCropDescription, setNewCropDescription] = useState('');

  const [quantity, setQuantity] = useState(searchParams.quantity || '');
  const [pricePerUnit, setPricePerUnit] = useState(searchParams.pricePerUnit || '');
  const [unit, setUnit] = useState<HarvestUnit>(HarvestUnit.KG);
  const [harvestDate, setHarvestDate] = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState(searchParams.shelfLifeDays || '30');
  const [stockMarge, setStockMarge] = useState('50');
  const [farmingMethods, setFarmingMethods] = useState(searchParams.farmingMethods || '');

  // Parse initial photos from searchParams (supports multiple server URLs from analyze step)
  const initialPhotos: string[] = (() => {
    if (searchParams.photoUrls) {
      try {
        const parsed = JSON.parse(searchParams.photoUrls);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        const split = searchParams.photoUrls.split(',').filter(Boolean);
        if (split.length > 0) return split;
      }
    }
    if (searchParams.photoUrl) return [searchParams.photoUrl];
    return [];
  })();

  // Photos state for HarvestPhotoPicker
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [featuredPhotoIndex, setFeaturedPhotoIndex] = useState(
    searchParams.featuredPhotoIndex ? Number(searchParams.featuredPhotoIndex) || 0 : 0,
  );

  // Review Mode state (when opening an analyzed draft from notification/dashboard)
  const [reviewedDraft, setReviewedDraft] = useState<OfflineHarvestDraft | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  // AI Assistant states (text-based helper)
  const [aiPrompt, setAiPrompt] = useState('');

  // Queries
  const { data: products } = useQuery(getProductsQuery());

  // Handle draft loading
  useEffect(() => {
    if (searchParams.draftId) {
      void getTempDraft(searchParams.draftId).then((draft) => {
        if (draft) {
          if (draft.localPhotos && draft.localPhotos.length > 0) {
            setPhotos(draft.localPhotos);
            setFeaturedPhotoIndex(draft.featuredPhotoIndex || 0);
          }
          if (draft.additionalNotes) {
            setFarmingMethods(draft.additionalNotes);
          }
        }
      });
    } else if (searchParams.reviewDraftId) {
      void getTempDraft(searchParams.reviewDraftId).then((draft) => {
        if (draft) {
          setReviewedDraft(draft);
          setIsReviewMode(true);
          if (draft.localPhotos && draft.localPhotos.length > 0) {
            setPhotos(draft.localPhotos);
            setFeaturedPhotoIndex(draft.featuredPhotoIndex || 0);
          }
          if (draft.manualForm) {
            if (draft.manualForm.productId) {
              setProductId(draft.manualForm.productId);
              setIsCustomCrop(false);
            } else if (draft.manualForm.isCustomCrop && draft.manualForm.customCrop) {
              setIsCustomCrop(true);
              setNewCropName(draft.manualForm.customCrop.name);
              setNewCropCategory(draft.manualForm.customCrop.category);
              setNewCropDescription(draft.manualForm.customCrop.description || '');
            }
            if (draft.manualForm.quantity) setQuantity(String(draft.manualForm.quantity));
            if (draft.manualForm.pricePerUnit) setPricePerUnit(String(draft.manualForm.pricePerUnit));
            if (draft.manualForm.unit) setUnit(draft.manualForm.unit);
            if (draft.manualForm.harvestDate) {
              setHarvestDate(draft.manualForm.harvestDate.substring(0, 10));
            }
            if (draft.manualForm.shelfLifeDays) setShelfLifeDays(draft.manualForm.shelfLifeDays);
            if (draft.manualForm.stockMarge) setStockMarge(String(draft.manualForm.stockMarge));
            if (draft.manualForm.farmingMethods) setFarmingMethods(draft.manualForm.farmingMethods);
          }
        }
      });
    }
  }, [searchParams.draftId, searchParams.reviewDraftId]);

  // Mutations
  const createProduct = useMutation(createProductMutation());
  const createHarvest = useMutation(createHarvestMutation());
  const aiSuggest = useMutation({
    ...aiSuggestHarvestMutation(),
    onSuccess: (data) => {
      if (data.category && Object.values(ProductCategory).includes(data.category as ProductCategory)) {
        setNewCropCategory(data.category as ProductCategory);
      }
      if (data.suggestedName) setNewCropName(data.suggestedName);
      if (data.farmingMethods) setFarmingMethods(data.farmingMethods);
      if (data.recommendedShelfLifeDays) setShelfLifeDays(String(data.recommendedShelfLifeDays));
      addToast('Suggestions IA appliquées !', 'success');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Erreur lors de la suggestion IA', 'error');
    },
  });

  const handleApplyAiReviewSuggestions = () => {
    if (!reviewedDraft?.aiResult) return;
    const ai = reviewedDraft.aiResult;

    if (ai.suggestedPricePerUnit) {
      setPricePerUnit(String(ai.suggestedPricePerUnit));
    }
    if (ai.estimatedQuantity) {
      setQuantity(String(ai.estimatedQuantity));
    }
    if (ai.recommendedShelfLifeDays) {
      setShelfLifeDays(String(ai.recommendedShelfLifeDays));
    }
    if (ai.farmingMethods) {
      setFarmingMethods((prev) => (prev ? `${prev} — ${ai.farmingMethods}` : ai.farmingMethods || ''));
    }
    addToast('Suggestions IA appliquées au formulaire !', 'success');
  };

  const calculateExpirationDate = (hDate: string, days: string) => {
    if (!hDate) return '';
    const date = new Date(hDate);
    const d = parseInt(days, 10) || 30;
    date.setDate(date.getDate() + d);
    return date.toISOString().split('T')[0] ?? '';
  };

  const calculatedExpiration = calculateExpirationDate(harvestDate, shelfLifeDays);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quantity || !pricePerUnit || !harvestDate) {
      addToast('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }

    if (isCustomCrop && !newCropName.trim()) {
      addToast('Veuillez entrer le nom de la culture.', 'error');
      return;
    }

    if (!isCustomCrop && !productId) {
      addToast('Veuillez sélectionner un produit du catalogue.', 'error');
      return;
    }

    if (isProxy && !effectiveFarmerUserId) {
      addToast('Agriculteur non spécifié pour cette déclaration par procuration.', 'error');
      return;
    }

    const expDate = calculatedExpiration
      ? new Date(calculatedExpiration).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString();

    const selectedProductObj = products?.find((p) => p.id === productId);
    const currentProductName = isCustomCrop
      ? newCropName.trim()
      : selectedProductObj?.name || 'Culture';

    // 1. OFFLINE MODE: Save to persistent IndexedDB
    if (!isOnline) {
      const draftPayload: OfflineHarvestDraft = {
        id: searchParams.draftId || searchParams.reviewDraftId || `draft_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'PENDING_AI_ANALYSIS',
        isProxy: isProxy ? true : undefined,
        farmerUserId: isProxy ? effectiveFarmerUserId : undefined,
        farmerName: isProxy ? effectiveFarmerName : undefined,
        localPhotos: photos,
        featuredPhotoIndex,
        additionalNotes: farmingMethods || undefined,
        manualForm: {
          productId: isCustomCrop ? undefined : productId,
          isCustomCrop,
          customCrop: isCustomCrop
            ? {
                name: newCropName.trim(),
                category: newCropCategory,
                description: newCropDescription.trim() || undefined,
              }
            : undefined,
          productName: currentProductName,
          quantity: Number(quantity),
          unit,
          pricePerUnit: Number(pricePerUnit),
          harvestDate: new Date(harvestDate).toISOString(),
          shelfLifeDays,
          stockMarge: Number(stockMarge) || 0,
          farmingMethods,
          farmerUserId: isProxy ? effectiveFarmerUserId : undefined,
          farmerName: isProxy ? effectiveFarmerName : undefined,
        },
        retryCount: 0,
      };

      await saveTempDraft(draftPayload);
      await refreshOfflineQueueState();

      addToast(
        isProxy
          ? `Mode hors-ligne : lot pour ${effectiveFarmerName || 'le producteur'} enregistré localement ! L'IA analysera les photos au retour du réseau.`
          : "Mode hors-ligne : récolte enregistrée localement ! Vos photos seront analysées par l'IA dès le retour du réseau.",
        'info',
      );

      onSuccessRedirect();
      return;
    }

    // 2. ONLINE MODE: Upload local photos if needed and create harvest
    try {
      const isServerUrl = (url: string) =>
        url.startsWith('/uploads/') ||
        url.startsWith('http://') ||
        url.startsWith('https://');

      let finalPhotoUrls: string[] = [];

      if (photos.length > 0) {
        const uploadPromises = photos.map(async (photoStr, idx) => {
          // If already a server URL, reuse it directly without re-uploading
          if (isServerUrl(photoStr)) {
            return photoStr;
          }
          // Only if it's a local Data URL (e.g. new photo added in the form), upload it
          if (photoStr.startsWith('data:')) {
            const file = dataUrlToFile(photoStr, `harvest-photo-${Date.now()}-${idx}.jpg`);
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await apiClient.post<{ data: { url: string } }>(
              '/media/upload',
              formData,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
              },
            );
            return data.data.url;
          }
          return photoStr;
        });
        finalPhotoUrls = await Promise.all(uploadPromises);
      }

      // Reorder designated cover photo to index 0 if another photo was selected as cover
      if (featuredPhotoIndex > 0 && finalPhotoUrls[featuredPhotoIndex]) {
        const cover = finalPhotoUrls[featuredPhotoIndex];
        if (cover) {
          finalPhotoUrls.splice(featuredPhotoIndex, 1);
          finalPhotoUrls.unshift(cover);
        }
      }

      let finalProductId = productId;
      if (isCustomCrop) {
        const newProduct = await createProduct.mutateAsync({
          name: newCropName.trim(),
          category: newCropCategory,
          description: newCropDescription.trim() || newCropName.trim(),
        });
        finalProductId = newProduct.id;
        await queryClient.invalidateQueries({ queryKey: ['products'] });
      }

      const harvestPayload: {
        productId: string;
        quantityInStock: number;
        unit: HarvestUnit;
        pricePerUnit: number;
        harvestDate: string;
        expirationDate: string;
        stockMarge: number;
        farmingMethods: string;
        photoUrls: string[];
      } = {
        productId: finalProductId,
        quantityInStock: Number(quantity),
        unit,
        pricePerUnit: Number(pricePerUnit),
        harvestDate: new Date(harvestDate).toISOString(),
        expirationDate: expDate,
        stockMarge: Number(stockMarge) || 0,
        farmingMethods: farmingMethods || 'Culture traditionnelle locale',
        photoUrls: finalPhotoUrls,
      };

      if (isProxy && effectiveFarmerUserId) {
        await apiClient.post('/harvests/proxy', {
          ...harvestPayload,
          farmerUserId: effectiveFarmerUserId,
        });
      } else {
        await createHarvest.mutateAsync(harvestPayload);
      }

      if (searchParams.reviewDraftId) {
        await deleteTempDraft(searchParams.reviewDraftId);
      } else if (searchParams.draftId) {
        await deleteTempDraft(searchParams.draftId);
      }

      await queryClient.invalidateQueries({ queryKey: ['harvests'] });

      addToast(
        isProxy
          ? 'Récolte validée et publiée par procuration avec succès !'
          : 'Récolte enregistrée et publiée avec succès !',
        'success',
      );

      onSuccessRedirect();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la récolte";
      addToast(errorMsg, 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 pb-28 text-[#0b1c30]">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="w-10 h-10 rounded-full border border-[#c0c9be] flex items-center justify-center text-[#004322] hover:bg-[#ebf4e6] active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <h1 className="font-display text-xl font-black text-[#004322] tracking-tight">
              {isReviewMode
                ? 'Révision & Confirmation'
                : isProxy
                ? 'Déclaration par Procuration'
                : 'Déclarer une Récolte'}
            </h1>
            <p className="text-xs text-[#707970]">
              {isProxy && effectiveFarmerName
                ? `Au nom de : ${effectiveFarmerName}`
                : 'Renseignez les détails du lot pour la mise en vente'}
            </p>
          </div>
        </div>
        {!isOnline && (
          <div className="flex items-center gap-1.5 bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-xs font-semibold">
            <span className="material-symbols-outlined text-sm text-amber-700 animate-pulse">cloud_off</span>
            <span>Hors-ligne</span>
          </div>
        )}
      </div>

      {/* Proxy Banner if applicable */}
      {isProxy && effectiveFarmerName && (
        <div className="mb-4 bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">person</span>
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider">Agriculteur Bénéficiaire</div>
            <div className="text-xs font-bold text-emerald-900">{effectiveFarmerName}</div>
          </div>
        </div>
      )}

      {/* Review Mode Banner / Comparative Analysis Card */}
      {isReviewMode && reviewedDraft?.aiResult && (
        <div className="mb-6 bg-gradient-to-br from-emerald-900 to-[#004322] text-white rounded-2xl p-5 shadow-lg space-y-4 border border-emerald-700 animate-slide-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-300 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              <div>
                <h3 className="font-bold text-sm text-white">Analyse IA Terminée</h3>
                <p className="text-[11px] text-emerald-200">
                  {isProxy && effectiveFarmerName ? `Lot pour : ${effectiveFarmerName}` : 'Récolte analysée en arrière-plan'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 text-amber-300 px-2.5 py-1 rounded-full text-xs font-bold">
              <span>{reviewedDraft.aiResult.aiQualityScore ? Math.round(reviewedDraft.aiResult.aiQualityScore * 10) : 90}%</span>
              <span>★</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 space-y-2.5 border border-white/10 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-emerald-200 block">Culture détectée :</span>
                <span className="font-bold text-white">{reviewedDraft.aiResult.suggestedName || 'Non reconnue'}</span>
              </div>
              <div>
                <span className="text-emerald-200 block">Quantité suggérée :</span>
                <span className="font-bold text-white">
                  {reviewedDraft.aiResult.estimatedQuantity ? `${reviewedDraft.aiResult.estimatedQuantity} Kg` : '—'}
                </span>
              </div>
              <div>
                <span className="text-emerald-200 block">Prix suggéré :</span>
                <span className="font-bold text-white">
                  {reviewedDraft.aiResult.suggestedPricePerUnit ? `${reviewedDraft.aiResult.suggestedPricePerUnit.toLocaleString()} CDF` : '—'}
                </span>
              </div>
              <div>
                <span className="text-emerald-200 block">Conservation :</span>
                <span className="font-bold text-white">
                  {reviewedDraft.aiResult.recommendedShelfLifeDays ? `${reviewedDraft.aiResult.recommendedShelfLifeDays} jours` : '30 jours'}
                </span>
              </div>
            </div>

            {reviewedDraft.aiResult.description && (
              <div className="pt-1.5 border-t border-white/10 text-[10px] text-emerald-100 italic">
                "{reviewedDraft.aiResult.description}"
              </div>
            )}

            <button
              type="button"
              onClick={handleApplyAiReviewSuggestions}
              className="w-full mt-1 bg-amber-400 hover:bg-amber-300 text-[#004322] font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-98"
            >
              <span className="material-symbols-outlined text-sm">auto_fix_high</span>
              Appliquer les suggestions de l'IA au formulaire
            </button>
          </div>
        </div>
      )}

      {/* Main Harvest Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Interactive Photo Picker */}
        <section className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs">
          <HarvestPhotoPicker
            photos={photos}
            onChangePhotos={setPhotos}
            featuredIndex={featuredPhotoIndex}
            onSelectFeaturedIndex={setFeaturedPhotoIndex}
          />
        </section>

        {/* Section 1: Produit / Culture */}
        <section className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#c0c9be]/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#004322]">psychiatry</span>
              <h2 className="text-sm font-bold text-[#004322]">Culture / Produit</h2>
            </div>
            <div className="flex items-center gap-1 bg-[#ebf4e6] p-0.5 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setIsCustomCrop(false)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  !isCustomCrop ? 'bg-white text-[#004322] shadow-xs' : 'text-[#707970]'
                }`}
              >
                Catalogue standard
              </button>
              <button
                type="button"
                onClick={() => setIsCustomCrop(true)}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  isCustomCrop ? 'bg-white text-[#004322] shadow-xs' : 'text-[#707970]'
                }`}
              >
                Nouvelle culture
              </button>
            </div>
          </div>

          {isCustomCrop ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Nom de la culture *</label>
                <input
                  value={newCropName}
                  onChange={(e) => setNewCropName(e.target.value)}
                  className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                  placeholder="Ex: Piments Habanero rouges"
                  required={isCustomCrop}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Catégorie</label>
                <select
                  value={newCropCategory}
                  onChange={(e) => setNewCropCategory(e.target.value as ProductCategory)}
                  className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                >
                  <option value={ProductCategory.VEGETABLES}>Légumes (VEGETABLES)</option>
                  <option value={ProductCategory.FRUITS}>Fruits (FRUITS)</option>
                  <option value={ProductCategory.CEREALS}>Céréales (CEREALS)</option>
                  <option value={ProductCategory.DATES}>Dattes (DATES)</option>
                  <option value={ProductCategory.DAIRY}>Laitier (DAIRY)</option>
                  <option value={ProductCategory.MEAT}>Viande (MEAT)</option>
                  <option value={ProductCategory.OTHER}>Autre (OTHER)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Description (optionnelle)</label>
                <input
                  value={newCropDescription}
                  onChange={(e) => setNewCropDescription(e.target.value)}
                  className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                  placeholder="Ex: Variété locale très parfumée"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Sélectionner dans le catalogue *</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                required={!isCustomCrop}
              >
                <option value="">-- Choisir un produit --</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Section 2: Quantités & Prix */}
        <section className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#c0c9be]/40 pb-3">
            <span className="material-symbols-outlined text-[#004322]">scale</span>
            <h2 className="text-sm font-bold text-[#004322]">Quantités & Prix</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Quantité disponible *</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                placeholder="Ex: 500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Unité de mesure</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as HarvestUnit)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
              >
                <option value={HarvestUnit.KG}>Kilogrammes (KG)</option>
                <option value={HarvestUnit.TON}>Tonnes (TON)</option>
                <option value={HarvestUnit.PIECE}>Pièces</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Prix unitaire (CDF/{unit}) *</label>
              <input
                type="number"
                min="1"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                placeholder="Ex: 1200"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Marge de sécurité ({unit})</label>
              <input
                type="number"
                min="0"
                value={stockMarge}
                onChange={(e) => setStockMarge(e.target.value)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                placeholder="Ex: 50"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Dates & Conservation */}
        <section className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#c0c9be]/40 pb-3">
            <span className="material-symbols-outlined text-[#004322]">calendar_month</span>
            <h2 className="text-sm font-bold text-[#004322]">Dates & Conservation</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Date de récolte *</label>
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Durée de conservation (Jours)</label>
              <input
                type="number"
                min="1"
                value={shelfLifeDays}
                onChange={(e) => setShelfLifeDays(e.target.value)}
                className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                placeholder="Ex: 30"
              />
            </div>
          </div>

          {calculatedExpiration && (
            <p className="text-[11px] text-[#707970] italic">
              Date limite estimée : <strong className="text-[#004322]">{calculatedExpiration}</strong>
            </p>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#404941] block">Méthodes de culture</label>
            <input
              value={farmingMethods}
              onChange={(e) => setFarmingMethods(e.target.value)}
              className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
              placeholder="Ex: Culture sous serre, sans pesticide chimique..."
            />
          </div>
        </section>

        {/* Section 4: Assistant IA Textuel (optionnel) */}
        <section className="bg-emerald-50/50 border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#004322]">smart_toy</span>
            <h2 className="text-sm font-bold text-[#004322]">Assistant IA (Optionnel)</h2>
          </div>
          <p className="text-[11px] text-[#707970]">
            Décrivez votre lot en quelques mots pour générer automatiquement les paramètres.
          </p>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 bg-white border border-[#c0c9be] rounded-lg p-2 text-xs outline-none focus:border-[#004322]"
              placeholder="Ex: 300kg de bananes plantains bio récoltées hier..."
            />
            <button
              type="button"
              onClick={() => {
                if (!aiPrompt.trim()) return;
                aiSuggest.mutate(aiPrompt.trim());
              }}
              disabled={aiSuggest.isPending || !aiPrompt.trim()}
              className="bg-[#004322] text-white px-3 py-2 rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
            >
              {aiSuggest.isPending ? 'Analyse...' : 'Suggérer'}
            </button>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="pt-2 space-y-2">
          <button
            type="submit"
            disabled={createHarvest.isPending || createProduct.isPending}
            className="w-full bg-[#004322] text-white font-bold py-3.5 rounded-xl hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">
              {!isOnline ? 'cloud_off' : isReviewMode ? 'check_circle' : 'publish'}
            </span>
            {createHarvest.isPending || createProduct.isPending
              ? 'Publication en cours...'
              : !isOnline
              ? isProxy
                ? 'Enregistrer par procuration hors-ligne'
                : 'Enregistrer hors-ligne (Analyse IA au retour réseau)'
              : isReviewMode
              ? isProxy
                ? 'Confirmer et publier par procuration'
                : 'Confirmer et publier la récolte'
              : isProxy
              ? 'Valider la récolte par procuration'
              : 'Publier la récolte'}
          </button>
        </div>
      </form>
    </div>
  );
}
