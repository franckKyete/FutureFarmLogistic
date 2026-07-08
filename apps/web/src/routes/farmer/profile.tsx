import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getFarmerProfileQuery, updateFarmerProfileMutation } from '@/features/profile/api/profile.queries';
import { getFarmerHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { getSellerOrdersQuery } from '@/features/orders/api/orders.queries';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/farmer/profile')({
  component: FarmerProfilePage,
});

function FarmerProfilePage() {
  const navigate = useNavigate();

  // Profile editable state
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');

  // Queries
  const { data: profile, refetch: refetchProfile } = useQuery(getFarmerProfileQuery());
  const { data: harvests } = useQuery(getFarmerHarvestsQuery());
  const { data: orders } = useQuery(getSellerOrdersQuery());

  useEffect(() => {
    if (profile) {
      setTempName(profile.companyName || '');
      setTempBio(profile.bio || '');
    }
  }, [profile]);

  // Mutations
  const updateProfile = useMutation({
    ...updateFarmerProfileMutation(),
    onSuccess: () => {
      addToast('Profil mis à jour avec succès.', 'success');
      setIsEditing(false);
      void refetchProfile();
    },
  });

  const handleSave = () => {
    if (!tempName) {
      addToast('Le nom de l\'exploitation est requis.', 'warning');
      return;
    }
    updateProfile.mutate({
      companyName: tempName,
      bio: tempBio,
    });
  };

  // Calculations
  const approvedHarvests = harvests ? harvests.filter((h) => h.status === 'APPROVED') : [];
  const averageQuality = approvedHarvests.length
    ? Math.round((approvedHarvests.reduce((sum, h) => sum + (h.qualityScore || 0), 0) / approvedHarvests.length) * 10)
    : 92;

  const totalRevenue = orders
    ? orders
        .filter((o) => o.status === 'CONFIRMED' || o.status === 'DELIVERED')
        .reduce((sum, o) => sum + o.totalPrice, 0)
    : 0;

  const productsCount = approvedHarvests.length;
  const ordersCount = orders ? orders.length : 0;

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] font-sans min-h-screen pb-20">
      {/* Top App Bar */}
      <header className="bg-[#f8f9ff] sticky top-0 z-[60] w-full border-b border-[#c0c9be] flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#004322]" style={{ fontVariationSettings: "'FILL' 1" }}>
            agriculture
          </span>
          <h1 className="text-[20px] font-bold text-[#004322]">Future Farm</h1>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto pb-8">
        {/* Hero Section: Banner & Profile Photo */}
        <section className="relative">
          <div className="h-48 w-full bg-[#e5eeff] overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt="Farm Banner"
              src="https://images.unsplash.com/photo-1500937386664-56d1590d333c?w=600"
            />
          </div>
          <div className="px-4 -mt-12 relative z-10">
            <div className="flex items-end justify-between">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-[#f8f9ff] bg-[#ffffff] overflow-hidden shadow-sm">
                  <img
                    className="w-full h-full object-cover"
                    alt="Farmer Expert"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBB1d9ebDFsj90_z8xiICMnVdEBYVya8fW6hkOkTMa1NylxNqtf4w1mG0oicw6QhDftK4B-dS9r-Ho0WhCKYH10uNAmf7FOLFCgOoPOGrt4D_gi1wH_Vbao6x4IKOkP6MyF6RQuqvWg78M3NAE97AfFYrKQyXpWaw0_aJ5-c4twzbsiwZCc9C8HqRWD5pX684CewN2O0-6HsGJMFJIZ3GUJbt-ciCFf_1h_3cq2lefj037z7Nk-woMHK6HT1Xt9al4dOa77uqZI24E"
                  />
                </div>
                {profile?.isCertified && (
                  <div className="absolute bottom-0 right-0 bg-[#004322] text-white rounded-full p-1 border-2 border-[#f8f9ff]">
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-[#004322] text-white px-4 py-2 rounded-lg font-semibold text-[12px] flex items-center gap-2 active:scale-95 transition-transform cursor-pointer shadow"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Modifier le profil
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Identity & Stats Section */}
        <section className="px-4 mt-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold text-[#0b1c30]">{profile?.companyName || 'Mon Exploitation'}</h2>
            {profile?.isCertified && (
              <span className="material-symbols-outlined text-[#1a5c35]">verified</span>
            )}
          </div>
          <p className="text-[14px] text-[#404941] mt-1">{profile?.bio || "Aucune description de l'exploitation."}</p>
          <div className="grid grid-cols-4 gap-4 mt-6 bg-[#eff4ff] p-4 rounded-xl border border-[#c0c9be] shadow-sm">
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#004322]">{productsCount}</p>
              <p className="text-[11px] text-[#404941]">Produits</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#004322]">{ordersCount}</p>
              <p className="text-[11px] text-[#404941]">Commandes</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-[#885200]">{averageQuality}%</p>
              <p className="text-[11px] text-[#404941]">Qualité</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold text-[#004322] truncate">{totalRevenue.toLocaleString()}</p>
              <p className="text-[11px] text-[#404941]">FCFA</p>
            </div>
          </div>
          <button
            onClick={() => void navigate({ to: '/farmer/harvests/analyze' })}
            className="w-full mt-3 border border-[#707970] text-[#004322] font-semibold text-[12px] py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#d3e4fe]/20 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            Voir les analyses de lots
          </button>
        </section>

        {/* Active Products Section */}
        <section className="px-4 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold">Catalogue de lots actifs</h3>
            <Link to="/farmer/stock" className="text-[#004322] font-semibold text-[12px] hover:underline">
              Gérer stock
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {approvedHarvests.length === 0 ? (
              <div className="bg-white border border-[#c0c9be] rounded-xl p-6 text-center text-[#404941] text-xs">
                Aucun lot récolté actif pour le moment.
              </div>
            ) : (
              approvedHarvests.map((h) => (
                <div key={h.id} className="bg-white border border-[#c0c9be] rounded-xl p-3 flex flex-col gap-3 shadow-sm">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200">
                      <img
                        className="w-full h-full object-cover"
                        alt="Harvest crop"
                        src={h.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100'}
                      />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-[13px] font-bold text-[#0b1c30] truncate">
                            {h.product?.name}
                          </h4>
                          <p className="text-[9px] text-[#004322] font-bold uppercase">
                            {h.product?.category}
                          </p>
                        </div>
                        <span className="bg-[#aef2be] text-[#00210d] px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0">
                          {h.qualityScore ? Math.round(h.qualityScore * 10) : 0}% Qualité
                        </span>
                      </div>
                      <p className="text-[#404941] text-[10px] mt-1 font-semibold">
                        Stock : {h.quantityInStock} {h.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[400px] p-6 space-y-4">
            <h3 className="text-[18px] font-semibold text-[#004322]">Modifier le profil</h3>
            <div className="space-y-1">
              <label className="text-[11px] text-[#404941] block">Nom de l'exploitation</label>
              <input
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px] outline-none"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#404941] block">Bio / Description</label>
              <textarea
                rows={3}
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px] outline-none"
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-[#707970] rounded-lg text-[12px] font-semibold text-[#404941] hover:bg-[#eff4ff] cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={updateProfile.isPending}
                className="px-4 py-2 bg-[#004322] text-white rounded-lg text-[12px] font-semibold hover:bg-[#004322]/90 cursor-pointer disabled:opacity-50"
              >
                {updateProfile.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f8f9ff] border-t border-[#c0c9be] flex justify-around items-center h-16 max-w-[480px] mx-auto px-2">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[12px] font-semibold">Accueil</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">grass</span>
          <span className="text-[12px] font-semibold">Stock</span>
        </Link>
        <Link
          to="/farmer/auctions"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">gavel</span>
          <span className="text-[12px] font-semibold">Enchères</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="text-[12px] font-semibold">Commandes</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-[#004322] font-bold hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="text-[12px] font-semibold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
