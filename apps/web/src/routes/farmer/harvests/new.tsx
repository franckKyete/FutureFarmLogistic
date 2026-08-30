import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getProductsQuery,
  createProductMutation,
  createHarvestMutation,
  aiSuggestHarvestMutation,
} from '@/features/harvests/api/harvests.queries';

import { addToast } from '@/features/shared/store/toast.store';
import { Permission, HarvestUnit, ProductCategory } from '@futurefarm/types';

export interface NewHarvestSearchParams {
  isIdentified?: string;
  productId?: string;
  quantity?: string;
  pricePerUnit?: string;
  shelfLifeDays?: string;
  farmingMethods?: string;
  photoUrl?: string;
  qualityScore?: string;
}

export const Route = createFileRoute('/farmer/harvests/new')({
  validateSearch: (search: Record<string, unknown>): NewHarvestSearchParams => {
    const res: NewHarvestSearchParams = {};
    if (typeof search['isIdentified'] === 'string') res.isIdentified = search['isIdentified'];
    if (typeof search['productId'] === 'string') res.productId = search['productId'];
    if (typeof search['quantity'] === 'string') res.quantity = search['quantity'];
    if (typeof search['pricePerUnit'] === 'string') res.pricePerUnit = search['pricePerUnit'];
    if (typeof search['shelfLifeDays'] === 'string') res.shelfLifeDays = search['shelfLifeDays'];
    if (typeof search['farmingMethods'] === 'string') res.farmingMethods = search['farmingMethods'];
    if (typeof search['photoUrl'] === 'string') res.photoUrl = search['photoUrl'];
    if (typeof search['qualityScore'] === 'string') res.qualityScore = search['qualityScore'];
    return res;
  },
  beforeLoad: () => {
    requireAuth(Permission.HARVEST_CREATE);
  },
  component: AddHarvestPage,
});

function AddHarvestPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  // Form states initialized with search params if present (from AI analysis)
  const [productId, setProductId] = useState(search.productId || '');
  const [isCustomCrop, setIsCustomCrop] = useState(
    search.isIdentified === 'false' || (!search.productId && search.isIdentified !== 'true'),
  );
  const [newCropName, setNewCropName] = useState('');
  const [newCropCategory, setNewCropCategory] = useState<ProductCategory>(ProductCategory.VEGETABLES);
  const [newCropDescription, setNewCropDescription] = useState('');

  const [quantity, setQuantity] = useState(search.quantity || '');
  const [pricePerUnit, setPricePerUnit] = useState(search.pricePerUnit || '');
  const [unit, setUnit] = useState<HarvestUnit>(HarvestUnit.KG);
  const [harvestDate, setHarvestDate] = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState(search.shelfLifeDays || '30');
  const [stockMarge, setStockMarge] = useState('50');
  const [farmingMethods, setFarmingMethods] = useState(search.farmingMethods || '');
  const [photoUrl, setPhotoUrl] = useState(search.photoUrl || '');

  // AI Assistant states (text-based helper)
  const [aiPrompt, setAiPrompt] = useState('');

  // Queries
  const { data: products } = useQuery(getProductsQuery());

  useEffect(() => {
    if (search.productId) {
      setProductId(search.productId);
      setIsCustomCrop(false);
    } else if (search.isIdentified === 'false') {
      setIsCustomCrop(true);
    }
  }, [search.productId, search.isIdentified]);

  // Mutations
  const createProduct = useMutation({
    ...createProductMutation(),
  });

  const createHarvest = useMutation({
    ...createHarvestMutation(),
    onSuccess: () => {
      addToast('Votre récolte a été enregistrée avec succès.', 'success');
      void navigate({ to: '/farmer/stock' });
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Erreur lors de la création de la récolte', 'error');
    },
  });

  const aiSuggest = useMutation({
    ...aiSuggestHarvestMutation(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      if (data.suggestedProductId) {
        setProductId(data.suggestedProductId);
        setIsCustomCrop(false);
      } else if (data.suggestedName) {
        setIsCustomCrop(true);
        setNewCropName(data.suggestedName);
        if (data.category) setNewCropCategory(data.category);
        if (data.description) setNewCropDescription(data.description);
      }
      if (data.recommendedShelfLifeDays) {
        setShelfLifeDays(String(data.recommendedShelfLifeDays));
      }
      if (data.farmingMethods) {
        setFarmingMethods(data.farmingMethods);
      }
      addToast('Suggestions de récolte générées avec succès !', 'success');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'Erreur IA', 'error');
    },
  });

  const handleAiSuggest = () => {
    if (!aiPrompt.trim()) {
      addToast('Veuillez saisir une description pour l\'assistant IA.', 'warning');
      return;
    }
    aiSuggest.mutate(aiPrompt);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let finalProductId = productId;

    if (isCustomCrop) {
      if (!newCropName.trim()) {
        addToast('Veuillez renseigner le nom de la nouvelle culture.', 'warning');
        return;
      }
      try {
        const newProduct = await createProduct.mutateAsync({
          name: newCropName.trim(),
          category: newCropCategory,
          description:
            newCropDescription.trim() ||
            `Culture ${newCropName.trim()} ajoutée par le producteur.`,
        });
        finalProductId = newProduct.id;
        await queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Erreur lors de la création de la culture', 'error');
        return;
      }
    } else if (!finalProductId) {
      addToast('Veuillez sélectionner un produit ou créer une nouvelle culture.', 'warning');
      return;
    }

    if (!quantity || !pricePerUnit || !harvestDate) {
      addToast('Veuillez remplir tous les champs obligatoires.', 'warning');
      return;
    }

    // Calculate expiration date from harvest date + shelf life days
    const harvestDateTime = new Date(harvestDate);
    const expirationDateTime = new Date(harvestDateTime.getTime() + Number(shelfLifeDays) * 24 * 60 * 60 * 1000);
    const expirationDate = expirationDateTime.toISOString();

    createHarvest.mutate({
      productId: finalProductId,
      parcelId: null,
      quantityInStock: Number(quantity),
      unit,
      pricePerUnit: Number(pricePerUnit),
      harvestDate: harvestDateTime.toISOString(),
      expirationDate,
      stockMarge: Number(stockMarge),
      farmingMethods: farmingMethods || '',
      photoUrls: photoUrl ? [photoUrl] : [],
    });
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-20 font-sans">
      <main className="pt-4 px-4 max-w-[480px] mx-auto space-y-6">
        {/* Unidentified Crop Warning Banner */}
        {search.isIdentified === 'false' && (
          <section className="bg-[#fff8e1] border border-[#ffe082] p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="material-symbols-outlined text-amber-700" style={{ fontVariationSettings: "'FILL' 1" }}>
              info
            </span>
            <div className="text-xs">
              <p className="font-bold text-amber-800">
                Culture non identifiée par l'IA
              </p>
              <p className="text-amber-900/80 mt-0.5">
                Veuillez renseigner le nom et la catégorie de votre produit ci-dessous. Il sera enregistré lors de la validation.
              </p>
            </div>
          </section>
        )}

        {/* Prefilled AI Banner */}
        {search.qualityScore && search.isIdentified !== 'false' && (
          <section className="bg-[#e8f5e9] border border-[#aef2be] p-4 rounded-xl flex items-center gap-3 shadow-sm">
            <span className="material-symbols-outlined text-[#1a5c35]" style={{ fontVariationSettings: "'FILL' 1" }}>
              stars
            </span>
            <div className="text-xs">
              <p className="font-bold text-[#1a5c35]">
                Champs pré-remplis par l'analyse d'image IA
              </p>
              <p className="text-[#404941] mt-0.5">
                Qualité estimée à <span className="font-bold">{search.qualityScore}%</span>. Veuillez vérifier et compléter les informations.
              </p>
            </div>
          </section>
        )}

        {/* AI Suggestions Card */}
        <section className="bg-[#e5eeff] border border-[#c0c9be] p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-[#0b1c30]">
            <span className="material-symbols-outlined text-[#004322]" style={{ fontVariationSettings: "'FILL' 1" }}>
              reviews
            </span>
            <h2 className="text-sm font-bold text-[#004322]">Assistant IA Récolte</h2>
          </div>
          <p className="text-[11px] text-[#404941] leading-relaxed">
            Décrivez votre lot (ex: "J'ai récolté 5 tonnes de soja biologique hier matin dans le champ Nord") pour que l'IA remplisse automatiquement les formulaires.
          </p>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 bg-white border border-[#c0c9be] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#004322]"
              placeholder="Décrivez votre lot..."
              type="text"
            />
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={aiSuggest.isPending}
              className="bg-[#004322] text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {aiSuggest.isPending ? 'Analyse...' : 'Suggérer'}
            </button>
          </div>
        </section>

        {/* Harvest Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-[#c0c9be] p-5 rounded-2xl shadow-sm">
          {/* Product Mode Selection Header */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-bold text-[#404941] block">Produit / Culture *</label>
              <button
                type="button"
                onClick={() => setIsCustomCrop(!isCustomCrop)}
                className="text-[11px] text-[#004322] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {isCustomCrop ? 'list' : 'add_circle'}
                </span>
                {isCustomCrop ? 'Choisir un produit existant' : '+ Créer une nouvelle culture'}
              </button>
            </div>

            {isCustomCrop ? (
              <div className="space-y-3 bg-[#f8f9ff] border border-[#c0c9be] p-3.5 rounded-xl">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#404941] block">Nom de la nouvelle culture *</label>
                  <input
                    value={newCropName}
                    onChange={(e) => setNewCropName(e.target.value)}
                    className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                    placeholder="Ex: Manioc Doux, Bananes Plantain..."
                    required={isCustomCrop}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#404941] block">Catégorie de produit *</label>
                  <select
                    value={newCropCategory}
                    onChange={(e) => setNewCropCategory(e.target.value as ProductCategory)}
                    className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[13px] outline-none focus:border-[#004322]"
                  >
                    <option value={ProductCategory.VEGETABLES}>Légumes & Tubercules (VEGETABLES)</option>
                    <option value={ProductCategory.FRUITS}>Fruits (FRUITS)</option>
                    <option value={ProductCategory.CEREALS}>Céréales & Légumineuses (CEREALS)</option>
                    <option value={ProductCategory.DATES}>Dattes (DATES)</option>
                    <option value={ProductCategory.DAIRY}>Produits Laitiers (DAIRY)</option>
                    <option value={ProductCategory.MEAT}>Viandes & Volailles (MEAT)</option>
                    <option value={ProductCategory.OTHER}>Autre / Cultures de rente (OTHER)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#404941] block">Description du produit (Optionnel)</label>
                  <input
                    value={newCropDescription}
                    onChange={(e) => setNewCropDescription(e.target.value)}
                    className="w-full bg-white border border-[#c0c9be] rounded-lg p-2.5 text-[12px] outline-none focus:border-[#004322]"
                    placeholder="Description commerciale pour les acheteurs..."
                  />
                </div>
              </div>
            ) : (
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
                required={!isCustomCrop}
              >
                <option value="">Sélectionnez un produit...</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            )}
          </div>



          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Quantité *</label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
                placeholder="Ex: 500"
                type="number"
                min="1"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Unité</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as HarvestUnit)}
                className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
              >
                <option value={HarvestUnit.KG}>Kilogrammes (KG)</option>
                <option value={HarvestUnit.TON}>Tonnes (TON)</option>
                <option value={HarvestUnit.PIECE}>Pièces (PIECE)</option>
              </select>
            </div>
          </div>

          {/* Price per unit */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#404941] block">Prix unitaire (CDF / unité) *</label>
            <input
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
              placeholder="Ex: 850"
              type="number"
              min="1"
              required
            />
          </div>

          {/* Harvest Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#404941] block">Date de récolte *</label>
            <input
              value={harvestDate}
              onChange={(e) => setHarvestDate(e.target.value)}
              className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
              type="date"
              required
            />
          </div>

          {/* Expiration shelf life */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Durée de conservation (jours)</label>
              <input
                value={shelfLifeDays}
                onChange={(e) => setShelfLifeDays(e.target.value)}
                className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
                type="number"
                min="1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Seuil alerte stock (marge)</label>
              <input
                value={stockMarge}
                onChange={(e) => setStockMarge(e.target.value)}
                className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
                type="number"
                min="0"
              />
            </div>
          </div>

          {/* Farming methods */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#404941] block">Méthodes de culture / Notes</label>
            <textarea
              value={farmingMethods}
              onChange={(e) => setFarmingMethods(e.target.value)}
              rows={3}
              className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
              placeholder="Ex: Biologique, labour minimal, sans OGM..."
            />
          </div>

          {/* Optional Photo URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#404941] block">URL de la photo (Optionnel)</label>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="w-full bg-[#f8f9ff] border border-[#c0c9be] rounded-lg p-3 text-[13px] outline-none focus:border-[#004322]"
              placeholder="https://images.unsplash.com/photo-..."
              type="url"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={createHarvest.isPending}
              className="w-full bg-[#004322] text-white py-3.5 rounded-xl text-xs font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              {createHarvest.isPending ? 'Enregistrement...' : 'Enregistrer la récolte'}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
