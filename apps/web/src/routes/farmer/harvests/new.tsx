import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getProductsQuery,
  createProductMutation,
  createHarvestMutation,
  mediaUploadMutation,
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
  photoUrls?: string;
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
    if (typeof search['photoUrls'] === 'string') res.photoUrls = search['photoUrls'];
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialPhotos = search.photoUrls
    ? search.photoUrls.split(',').filter(Boolean)
    : search.photoUrl
      ? [search.photoUrl]
      : [];
  const [photos, setPhotos] = useState<string[]>(initialPhotos);

  useEffect(() => {
    if (search.photoUrls) {
      setPhotos(search.photoUrls.split(',').filter(Boolean));
    } else if (search.photoUrl) {
      setPhotos([search.photoUrl]);
    }
  }, [search.photoUrls, search.photoUrl]);

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
  const uploadFile = useMutation({
    ...mediaUploadMutation(),
    onSuccess: (result) => {
      setPhotos((prev) => [...prev, result.url]);
      addToast('Photo ajoutée avec succès !', 'success');
    },
    onError: (err) => {
      addToast(
        err instanceof Error ? err.message : "Erreur lors de l'upload de la photo",
        'error',
      );
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => uploadFile.mutate(file));
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetPrimaryPhoto = (index: number) => {
    if (index === 0) return;
    setPhotos((prev) => {
      const selected = prev[index];
      if (!selected) return prev;
      const rest = prev.filter((_, i) => i !== index);
      return [selected, ...rest];
    });
  };

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
      photoUrls: photos,
      qualityScore: search.qualityScore ? Number(search.qualityScore) : 8.5,
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

          {/* Photo Gallery & Image Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#404941] block">
                Photos de la récolte ({photos.length})
              </label>
              <span className="text-[10px] text-gray-500">
                La première photo sert d'image principale
              </span>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((url, idx) => (
                <div
                  key={idx}
                  className={`relative rounded-xl overflow-hidden border group aspect-square bg-gray-100 shadow-2xs ${
                    idx === 0
                      ? 'border-[#004322] ring-2 ring-[#004322]/20'
                      : 'border-[#c0c9be]'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Photo récolte ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-[#004322] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      Principale
                    </span>
                  )}
                  {idx !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryPhoto(idx)}
                      className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 hover:bg-[#004322] text-white text-[9px] font-bold py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-center cursor-pointer"
                    >
                      Définir principale
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-700 active:scale-90 transition-all cursor-pointer shadow-sm"
                    title="Supprimer la photo"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Upload loading tile */}
              {uploadFile.isPending && (
                <div className="aspect-square rounded-xl border border-dashed border-[#004322] bg-[#f8f9ff] flex flex-col items-center justify-center gap-1">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#004322] border-t-transparent" />
                  <span className="text-[10px] text-gray-500 font-semibold">Envoi...</span>
                </div>
              )}

              {/* Add photo button tile */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadFile.isPending}
                className="aspect-square rounded-xl border-2 border-dashed border-[#c0c9be] hover:border-[#004322] bg-[#f8f9ff] hover:bg-emerald-50/40 flex flex-col items-center justify-center gap-1 text-[#404941] hover:text-[#004322] transition-colors cursor-pointer group disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">
                  add_photo_alternate
                </span>
                <span className="text-[10px] font-bold">Ajouter</span>
              </button>
            </div>
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
