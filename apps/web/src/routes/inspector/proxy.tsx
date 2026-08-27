import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useProducers } from '@/features/inspector/api/accounts.queries';
import { HarvestUnit } from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/inspector/proxy')({
  component: InspectorProxyPage,
});

interface ProductTemplate {
  id: string;
  name: string;
  category: string;
}

function InspectorProxyPage() {
  const [activeTab, setActiveTab] = useState<'register' | 'harvest'>('register');

  // Tab 1: Register Farmer state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);

  // Tab 2: Register Harvest state
  const { data: producers = [] } = useProducers({ role: 'Farmer' });
  const { data: products = [] } = useQuery<ProductTemplate[]>({
    queryKey: ['products', 'templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: ProductTemplate[] }>('/products');
      return data.data || [];
    },
  });

  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [stockMarge, setStockMarge] = useState<number | ''>(0);
  const [pricePerUnit, setPricePerUnit] = useState<number | ''>('');
  const [unit, setUnit] = useState<HarvestUnit>(HarvestUnit.KG);
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState('');
  const [farmingMethods, setFarmingMethods] = useState('');

  // Mutations
  const registerFarmerProxy = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/users/register/farmer/proxy', payload);
      return data.data;
    },
    onSuccess: (data) => {
      addToast('Compte producteur créé avec succès !', 'success');
      if (data?.temporaryPassword) {
        setCreatedTempPassword(data.temporaryPassword);
      }
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCompanyName('');
      setAddress('');
      setBio('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la création du compte';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const createHarvestProxy = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await apiClient.post('/harvests/proxy', payload);
      return data.data;
    },
    onSuccess: () => {
      addToast('Récolte enregistrée avec succès par procuration', 'success');
      setSelectedProductId('');
      setQuantity('');
      setPricePerUnit('');
      setFarmingMethods('');
      setExpirationDate('');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors de l'enregistrement de la récolte";
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedTempPassword(null);
    registerFarmerProxy.mutate({
      firstName,
      lastName,
      email,
      phoneNumber: phone || undefined,
      companyName,
      address,
      bio: bio || undefined,
    });
  };

  const handleHarvestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarmerId || !selectedProductId || !quantity || !pricePerUnit) {
      addToast('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    createHarvestProxy.mutate({
      farmerUserId: selectedFarmerId,
      productId: selectedProductId,
      quantityInStock: Number(quantity),
      stockMarge: Number(stockMarge) || 0,
      pricePerUnit: Number(pricePerUnit),
      unit,
      harvestDate,
      expirationDate: expirationDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      farmingMethods: farmingMethods || 'Culture traditionnelle locale',
      photoUrls: [],
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8f9ff] font-sans pb-24">
      {/* Top Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a5c35]">Assistance Terrain</span>
        <h1 className="text-xl font-bold text-[#0b1c30]">Actions par Procuration</h1>

        {/* Tab Switcher */}
        <div className="flex gap-2 mt-3 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'register' ? 'bg-white text-[#1a5c35] shadow-xs' : 'text-gray-600'
            }`}
          >
            Créer Producteur
          </button>
          <button
            onClick={() => setActiveTab('harvest')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'harvest' ? 'bg-white text-[#1a5c35] shadow-xs' : 'text-gray-600'
            }`}
          >
            Déclarer Récolte
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 flex-1">
        {activeTab === 'register' ? (
          <div className="space-y-4">
            {/* Generated Password Card */}
            {createdTempPassword && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 animate-slide-in">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <span className="material-symbols-outlined text-base text-emerald-600">key</span>
                  Mot de passe temporaire généré
                </div>
                <p className="text-[11px] text-emerald-800">
                  Veuillez transmettre ce code d'accès au producteur afin qu'il puisse se connecter ultérieurement :
                </p>
                <div className="bg-white p-3 rounded-xl border border-emerald-300 font-mono text-base font-bold text-center tracking-widest text-emerald-950">
                  {createdTempPassword}
                </div>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0b1c30]">Enregistrement d'un agriculteur</h3>
                <p className="text-xs text-gray-500">
                  Permet d'inscrire un producteur rural n'ayant pas d'accès direct à internet.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Koffi"
                    className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Konan"
                    className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="koffi.konan@rural.ci"
                    className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 07..."
                    className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom de l'exploitation / Ferme</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Plantation de Cacao Konan & Fils"
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Localité / Adresse de la ferme</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Village N'Gattakro, Soubré"
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description / Notes (optionnel)</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Spécialisé dans les fèves de cacao séchées et le manioc..."
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={registerFarmerProxy.isPending}
                className="w-full py-3 bg-[#1a5c35] text-white font-bold text-xs rounded-xl hover:bg-[#144a2a] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {registerFarmerProxy.isPending ? 'Création en cours...' : 'Inscrire le producteur'}
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleHarvestSubmit} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Déclaration de récolte par procuration</h3>
              <p className="text-xs text-gray-500">
                Enregistrez un lot de récolte au nom d'un agriculteur suivi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Choisir le producteur</label>
              <select
                required
                value={selectedFarmerId}
                onChange={(e) => setSelectedFarmerId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              >
                <option value="">-- Sélectionner un agriculteur --</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} {p.farmName ? `(${p.farmName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Produit / Culture</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              >
                <option value="">-- Choisir la culture --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Quantité en stock</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                  placeholder="500"
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Unité</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as HarvestUnit)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                >
                  <option value={HarvestUnit.KG}>Kilogramme (KG)</option>
                  <option value={HarvestUnit.TON}>Tonne (TON)</option>
                  <option value={HarvestUnit.PIECE}>Pièce</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Prix unitaire (CDF)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value ? Number(e.target.value) : '')}
                  placeholder="2500"
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Marge de sécurité</label>
                <input
                  type="number"
                  min="0"
                  value={stockMarge}
                  onChange={(e) => setStockMarge(e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date de récolte</label>
                <input
                  type="date"
                  required
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date limite de conso</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Méthodes de culture</label>
              <textarea
                rows={2}
                value={farmingMethods}
                onChange={(e) => setFarmingMethods(e.target.value)}
                placeholder="Agriculture raisonnée, sans pesticides de synthèse..."
                className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white text-gray-900 focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={createHarvestProxy.isPending}
              className="w-full py-3 bg-[#1a5c35] text-white font-bold text-xs rounded-xl hover:bg-[#144a2a] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {createHarvestProxy.isPending ? 'Enregistrement...' : 'Valider la récolte par procuration'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
