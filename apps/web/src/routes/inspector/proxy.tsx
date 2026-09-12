import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { addToast } from '@/features/shared/store/toast.store';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { requireRole } from '@/features/auth/utils/role-guard';
import { Permission } from '@futurefarm/types';
import { useProducers } from '@/features/inspector/api/accounts.queries';
import { useOfflineSyncState } from '@/features/harvests/offline';

export interface InspectorProxySearchParams {
  tab?: 'register' | 'harvest' | undefined;
}

export const Route = createFileRoute('/inspector/proxy')({
  validateSearch: (search: Record<string, unknown>): InspectorProxySearchParams => {
    const result: InspectorProxySearchParams = {
      tab: (search.tab as 'register' | 'harvest') || 'register',
    };
    return result;
  },
  beforeLoad: () => {
    requireAuth(
      [Permission.FARMER_PROXY_HARVEST_MANAGE, Permission.INSPECTION_CREATE, Permission.INSPECTION_READ],
      'any',
    );
    requireRole(['Inspector']);
  },
  component: InspectorProxyPage,
});

function InspectorProxyPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline, tempDrafts } = useOfflineSyncState();

  const [activeTab, setActiveTab] = useState<'register' | 'harvest'>(search.tab || 'register');

  // Tab 1: Register Farmer state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);

  // Tab 2: Producer Selection state
  const { data: producers = [], isLoading: isLoadingProducers } = useProducers({ role: 'Farmer' });
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [farmerSearchQuery, setFarmerSearchQuery] = useState('');

  // Filter proxy drafts
  const proxyDraftsReadyForReview = tempDrafts.filter(
    (d) => d.isProxy && d.status === 'ANALYZED_READY_FOR_REVIEW',
  );
  const proxyDraftsPendingAnalysis = tempDrafts.filter(
    (d) => d.isProxy && (d.status === 'PENDING_AI_ANALYSIS' || d.status === 'ANALYZING'),
  );

  // Filter producers by search query
  const filteredProducers = producers.filter((p) => {
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
    const email = (p.email || '').toLowerCase();
    const farm = (p.farmName || '').toLowerCase();
    const query = farmerSearchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query) || farm.includes(query);
  });

  const selectedProducer = producers.find((p) => p.id === selectedFarmerId);
  const selectedFarmerName = selectedProducer
    ? `${selectedProducer.firstName || ''} ${selectedProducer.lastName || ''}`.trim() ||
      selectedProducer.farmName ||
      'Agriculteur'
    : '';

  // Mutation: Register Farmer Proxy
  const registerFarmerProxy = useMutation({
    mutationFn: async (payload: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      companyName: string;
      address: string;
      bio?: string;
    }) => {
      const { data } = await apiClient.post<{ data: { temporaryPassword?: string } }>(
        '/users/register/farmer/proxy',
        payload,
      );
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
      void queryClient.invalidateQueries({ queryKey: ['inspector', 'producers'] });
    },
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string | string[] } } };
      const msg = errorObj.response?.data?.message || 'Erreur lors de la création du compte';
      addToast(Array.isArray(msg) ? msg[0] || 'Erreur' : msg, 'error');
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !companyName || !address) {
      addToast('Veuillez remplir tous les champs obligatoires.', 'warning');
      return;
    }
    const payload: {
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      companyName: string;
      address: string;
      bio?: string;
    } = {
      firstName,
      lastName,
      email,
      companyName,
      address,
    };
    if (phone.trim()) payload.phoneNumber = phone.trim();
    if (bio.trim()) payload.bio = bio.trim();
    registerFarmerProxy.mutate(payload);
  };

  const handleStartHarvestFlow = () => {
    if (!selectedFarmerId || !selectedProducer) {
      addToast('Veuillez sélectionner un agriculteur.', 'warning');
      return;
    }

    void navigate({
      to: '/inspector/harvests/analyze',
      search: {
        farmerUserId: selectedProducer.id,
        farmerName: selectedFarmerName,
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 text-[#0b1c30]">
      {/* Top Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#1a5c35] uppercase tracking-wider">
              Assistance Terrain
            </div>
            <h1 className="font-display text-2xl font-black text-[#004322] tracking-tight">
              Actions par Procuration
            </h1>
          </div>
          {!isOnline && (
            <div className="flex items-center gap-1.5 bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-xs font-semibold">
              <span className="material-symbols-outlined text-sm text-amber-700 animate-pulse">
                cloud_off
              </span>
              <span>Hors-ligne</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => {
            setActiveTab('register');
            void navigate({ to: '/inspector/proxy', search: { tab: 'register' } });
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'register' ? 'bg-white text-[#004322] shadow-xs' : 'text-gray-500'
          }`}
        >
          Créer Producteur
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('harvest');
            void navigate({ to: '/inspector/proxy', search: { tab: 'harvest' } });
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer relative ${
            activeTab === 'harvest' ? 'bg-white text-[#004322] shadow-xs' : 'text-gray-500'
          }`}
        >
          <span>Déclarer Récolte</span>
          {proxyDraftsReadyForReview.length > 0 && (
            <span className="ml-2 bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {proxyDraftsReadyForReview.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Register Farmer */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-200 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[#0b1c30]">
              Enregistrement d'un Producteur sans Smartphone
            </h2>
            <p className="text-xs text-gray-500">
              Créez un compte pour un agriculteur non digitalisé. Un mot de passe temporaire sera
              généré pour lui permettre d'accéder ultérieurement à son compte.
            </p>
          </div>

          {createdTempPassword && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <span className="material-symbols-outlined text-sm">key</span>
                Mot de passe temporaire généré avec succès
              </div>
              <p className="text-xs text-emerald-700">
                Communiquez ce code au producteur pour sa première connexion :
              </p>
              <div className="font-mono text-base font-black bg-white px-3 py-1.5 rounded-lg border border-emerald-300 inline-block text-emerald-950 select-all">
                {createdTempPassword}
              </div>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Prénom *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                  placeholder="Ex: Jean"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Nom *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                  placeholder="Ex: Mutombo"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                  placeholder="Ex: jean.mutombo@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Téléphone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                  placeholder="Ex: +243 812 345 678"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Nom de la ferme / Exploitation *</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                  placeholder="Ex: Ferme Mutombo & Fils"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Localisation / Adresse *</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                  placeholder="Ex: Village Mbanza-Ngungu, Kongo-Central"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Description / Notes</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs outline-none focus:border-[#1a5c35]"
                placeholder="Ex: Producteur spécialisé dans le manioc et le maïs..."
              />
            </div>

            <button
              type="submit"
              disabled={registerFarmerProxy.isPending}
              className="w-full bg-[#1a5c35] text-white font-bold py-3 rounded-xl hover:bg-[#144a2a] active:scale-98 transition-all cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              {registerFarmerProxy.isPending ? 'Création en cours...' : 'Créer le compte producteur'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Declare Harvest Flow (Farmer Selector -> Analyze -> Form) */}
      {activeTab === 'harvest' && (
        <div className="space-y-6">
          {/* Section A: Ready-for-review proxy drafts */}
          {proxyDraftsReadyForReview.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                <span className="material-symbols-outlined text-emerald-700">auto_awesome</span>
                <span>Récoltes analysées prêtes pour révision ({proxyDraftsReadyForReview.length})</span>
              </div>
              <div className="space-y-2">
                {proxyDraftsReadyForReview.map((draft) => (
                  <div
                    key={draft.id}
                    className="bg-white p-3 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      {draft.localPhotos?.[0] ? (
                        <img
                          src={draft.localPhotos[0]}
                          alt="Récolte"
                          className="w-12 h-12 rounded-lg object-cover border border-emerald-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <span className="material-symbols-outlined text-xl">psychiatry</span>
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          {draft.manualForm?.productName || draft.aiResult?.suggestedName || 'Culture'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Producteur : <strong className="text-gray-700">{draft.farmerName || 'Agriculteur'}</strong>
                        </div>
                        {draft.aiResult?.aiQualityScore && (
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            Qualité IA : {Math.round(draft.aiResult.aiQualityScore * 10)}% ★
                          </div>
                        )}
                      </div>
                    </div>

                    <Link
                      to="/inspector/harvests/new"
                      search={{
                        reviewDraftId: draft.id,
                        farmerUserId: draft.farmerUserId,
                        farmerName: draft.farmerName,
                      }}
                      className="bg-[#004322] hover:bg-[#1a5c35] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-xs"
                    >
                      Réviser & Valider
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section B: Pending AI analysis drafts */}
          {proxyDraftsPendingAnalysis.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                <span className="material-symbols-outlined text-amber-700 animate-spin">sync</span>
                <span>Lots en attente d'analyse IA en arrière-plan ({proxyDraftsPendingAnalysis.length})</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Ces lots ont été enregistrés hors-ligne. Dès que votre connexion est stable, ils seront
                automatiquement analysés et disponibles pour révision.
              </p>
            </div>
          )}

          {/* Section C: Select Farmer and Start Harvest Flow */}
          <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-200 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#004322]">
                1. Sélectionner l'agriculteur
              </h2>
              <p className="text-xs text-gray-500">
                Choisissez le producteur pour lequel vous souhaitez déclarer une nouvelle récolte sur le terrain.
              </p>
            </div>

            {/* Farmer Search input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={farmerSearchQuery}
                onChange={(e) => setFarmerSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, email ou exploitation..."
                className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:border-[#1a5c35] focus:bg-white"
              />
            </div>

            {/* Farmer Cards / Selector Grid */}
            {isLoadingProducers ? (
              <div className="py-8 text-center text-xs text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#1a5c35] mx-auto mb-2" />
                Chargement des producteurs...
              </div>
            ) : filteredProducers.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                Aucun agriculteur trouvé. Créez-en un dans l'onglet "Créer Producteur".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {filteredProducers.map((producer) => {
                  const pId = producer.id;
                  const isSelected = selectedFarmerId === pId;
                  const name =
                    `${producer.firstName || ''} ${producer.lastName || ''}`.trim() ||
                    producer.farmName ||
                    'Agriculteur';

                  return (
                    <div
                      key={pId}
                      onClick={() => setSelectedFarmerId(pId)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex items-center justify-between ${
                        isSelected
                          ? 'border-[#004322] bg-emerald-50/70 ring-2 ring-[#004322]/20 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isSelected ? 'bg-[#004322] text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {producer.firstName?.[0] || 'A'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 truncate">{name}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {producer.farmName || producer.email || 'Exploitation agricole'}
                          </div>
                          {producer.phone && (
                            <div className="text-[10px] text-gray-400 truncate">
                              {producer.phone}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-2">
                        <span
                          className={`material-symbols-outlined text-lg ${
                            isSelected ? 'text-[#004322]' : 'text-gray-300'
                          }`}
                        >
                          {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Farmer Action Box */}
            {selectedProducer && (
              <div className="pt-3 border-t border-gray-200 space-y-4">
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#004322]">how_to_reg</span>
                    <div>
                      <div className="text-[11px] font-bold text-emerald-950">Agriculteur sélectionné</div>
                      <div className="text-xs font-bold text-[#004322]">{selectedFarmerName}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFarmerId('')}
                    className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
                  >
                    Changer
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStartHarvestFlow}
                  className="w-full bg-[#004322] hover:bg-[#1a5c35] text-white font-bold py-4 rounded-xl active:scale-98 transition-all cursor-pointer shadow-md text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                  Commencer l'analyse de récolte pour {selectedFarmerName}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
