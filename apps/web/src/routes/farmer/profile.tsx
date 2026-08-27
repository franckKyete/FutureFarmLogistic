import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  getFarmerProfileQuery,
  updateFarmerProfileMutation,
  uploadMediaFile,
} from '@/features/profile/api/profile.queries';
import { getFarmerHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { getSellerOrdersQuery } from '@/features/orders/api/orders.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { FarmerBottomNav } from '@/features/farmer/components/FarmerBottomNav';

export const Route = createFileRoute('/farmer/profile')({
  component: FarmerProfilePage,
});

function FarmerProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile editable state
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Queries
  const { data: profile, refetch: refetchProfile } = useQuery(getFarmerProfileQuery());
  const { data: harvests } = useQuery(getFarmerHarvestsQuery());
  const { data: orders } = useQuery(getSellerOrdersQuery());

  useEffect(() => {
    if (profile) {
      setTempName(profile.companyName || '');
      setTempBio(profile.bio || '');
      setTempAvatarUrl(profile.avatarUrl || null);
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
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la mise à jour du profil';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP)', 'error');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const uploadedUrl = await uploadMediaFile(file);
      setTempAvatarUrl(uploadedUrl);

      // Save directly to profile
      const payload: {
        companyName: string;
        address: string;
        bio?: string;
        avatarUrl?: string;
      } = {
        companyName: profile?.companyName || `${user?.firstName || 'Farmer'} ${user?.lastName || ''}`.trim(),
        address: profile?.address || '',
        avatarUrl: uploadedUrl,
      };
      if (profile?.bio) payload.bio = profile.bio;

      await updateProfile.mutateAsync(payload);
      addToast('Photo de profil mise à jour !', 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erreur lors du téléchargement de l'image";
      addToast(msg, 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (!tempName.trim()) {
      addToast("Le nom de l'exploitation est requis.", 'warning');
      return;
    }
    const payload: {
      companyName: string;
      bio?: string;
      avatarUrl?: string;
    } = {
      companyName: tempName.trim(),
    };
    if (tempBio.trim()) payload.bio = tempBio.trim();
    if (tempAvatarUrl) payload.avatarUrl = tempAvatarUrl;

    updateProfile.mutate(payload);
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

  const currentAvatarSrc =
    profile?.avatarUrl ||
    (user
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(`${user.firstName} ${user.lastName}`)}&background=004322&color=fff&bold=true`
      : 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100');

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] font-sans min-h-screen pb-20">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

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
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-[#f8f9ff] bg-[#ffffff] overflow-hidden shadow-sm relative">
                  <img
                    className="w-full h-full object-cover"
                    alt={user?.firstName || 'Farmer'}
                    src={currentAvatarSrc}
                  />
                  {/* Upload Avatar Overlay Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
                    title="Changer la photo de profil"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {isUploadingAvatar ? 'hourglass_top' : 'photo_camera'}
                    </span>
                    <span className="text-[9px] font-bold mt-0.5">
                      {isUploadingAvatar ? 'Envoi...' : 'Modifier'}
                    </span>
                  </button>
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
            <h2 className="text-[18px] font-bold text-[#0b1c30]">
              {profile?.companyName || (user ? `${user.firstName} ${user.lastName}` : 'Mon Exploitation')}
            </h2>
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
              <p className="text-[11px] text-[#404941]">CDF</p>
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
          <div className="bg-white rounded-2xl w-full max-w-[400px] p-6 space-y-4 shadow-xl">
            <h3 className="text-[18px] font-semibold text-[#004322]">Modifier le profil</h3>

            {/* Avatar upload in modal */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <img
                src={tempAvatarUrl || currentAvatarSrc}
                alt="Avatar preview"
                className="w-14 h-14 rounded-full object-cover border-2 border-emerald-600 shrink-0"
              />
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-800">Photo de profil</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="mt-1 text-xs text-[#004322] font-bold underline hover:text-[#002b15] cursor-pointer"
                >
                  {isUploadingAvatar ? 'Téléchargement...' : 'Changer l’image'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Nom de l'exploitation</label>
              <input
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px] outline-none"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Bio / Description</label>
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
      <FarmerBottomNav />
    </div>
  );
}
