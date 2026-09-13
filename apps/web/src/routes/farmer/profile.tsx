import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  getFarmerProfileByIdQuery,
  uploadMediaFile,
} from '@/features/profile/api/profile.queries';
import {
  getFarmerHarvestsQuery,
  getMarketplaceHarvestsQuery,
} from '@/features/harvests/api/harvests.queries';
import { getSellerOrdersQuery } from '@/features/orders/api/orders.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { clearAuth, updateAuthUser } from '@/features/auth/store/auth.store';
import { useUpdateUser } from '@/features/admin/api/users.queries';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';
import {
  AddressInputGroup,
  type AddressValue,
  toAddressValue,
} from '@/features/addresses/components';
import { Icon } from '@/features/shared/components/Icon';

export interface FarmerProfileSearchParams {
  id?: string | undefined;
}

export const Route = createFileRoute('/farmer/profile')({
  validateSearch: (search: Record<string, unknown>): FarmerProfileSearchParams => ({
    id: typeof search.id === 'string' && search.id.trim() ? search.id.trim() : undefined,
  }),
  component: FarmerProfilePage,
});

const CATEGORY_LABEL: Record<string, string> = {
  VEGETABLES: 'MARAÎCHAGE',
  FRUITS: 'FRUITS',
  CEREALS: 'CÉRÉALES',
  DATES: 'DATTES',
  DAIRY: 'PRODUITS LAITIERS',
  MEAT: 'ÉLEVAGE',
  LEGUMES: 'LÉGUMINEUSES',
  OTHER: 'AUTRE',
};

function formatHarvestDate(dateStr?: string | null): string {
  if (!dateStr) return 'Récemment';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatMonth(dateStr?: string | null): string {
  if (!dateStr) return 'Récent';
  try {
    const d = new Date(dateStr);
    const m = d.toLocaleDateString('fr-FR', { month: 'short' });
    return m.charAt(0).toUpperCase() + m.slice(1);
  } catch {
    return 'Récent';
  }
}

export function FarmerProfilePage() {
  const { id: targetFarmerId } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Profile editable state
  const [isEditing, setIsEditing] = useState(false);
  const [tempFirstName, setTempFirstName] = useState('');
  const [tempLastName, setTempLastName] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempName, setTempName] = useState('');
  const [tempAddress, setTempAddress] = useState<AddressValue>({
    streetAddress: '',
    streetAddress2: '',
    city: '',
    stateOrProvince: '',
    country: 'COD',
  });
  const [tempBio, setTempBio] = useState('');
  const [tempIsCertified, setTempIsCertified] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);
  const [tempBannerUrl, setTempBannerUrl] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Query farmer profile (either targeted by id or current user's profile)
  const {
    data: profile,
    isLoading: isLoadingProfile,
    refetch: refetchProfile,
  } = useQuery(getFarmerProfileByIdQuery(targetFarmerId));

  // Check if current user is a farmer
  const isFarmer = Boolean(user?.roles?.includes('Farmer'));

  // Only a farmer can own a farmer profile. If targetFarmerId is present, verify ownership.
  const isOwner =
    isFarmer &&
    (!targetFarmerId ||
      Boolean(
        user &&
          profile &&
          (profile.userId === user.id ||
            profile.id === (user as any).farmerProfileId ||
            profile.id === (user as any).farmerProfile?.id),
      ));

  // Configure farmer layout: hide top bar (page has custom header) and hide bottom nav for buyer view
  useFarmerLayout({
    hideTopBar: true,
    hideBottomNav: !isOwner,
  });

  // Harvests queries (owner gets full harvests, public visitor gets marketplace approved harvests)
  const { data: ownerHarvests } = useQuery({
    ...getFarmerHarvestsQuery(),
    enabled: isOwner,
  });

  const { data: publicHarvests } = useQuery({
    ...getMarketplaceHarvestsQuery(undefined, profile?.id || targetFarmerId),
    enabled: !isOwner && Boolean(profile?.id || targetFarmerId),
  });

  const { data: orders } = useQuery({
    ...getSellerOrdersQuery(),
    enabled: isOwner,
  });

  const updateUserMutation = useUpdateUser();

  const syncFormState = useCallback(() => {
    const prof = profile;
    const u = user;
    const profUser = (prof as any)?.user;

    setTempFirstName(u?.firstName || profUser?.firstName || '');
    setTempLastName(u?.lastName || profUser?.lastName || '');
    setTempEmail(u?.email || profUser?.email || '');

    const resolvedPhone =
      (u as any)?.phoneNumber ||
      (u as any)?.phone ||
      profUser?.phoneNumber ||
      profUser?.phone ||
      (prof as any)?.phoneNumber ||
      (prof as any)?.phone ||
      (prof as any)?.addressDetails?.phoneNumber ||
      (prof as any)?.addresses?.[0]?.phoneNumber ||
      '';
    setTempPhone(resolvedPhone);

    if (prof) {
      setTempName(prof.companyName || '');
      setTempAddress(
        toAddressValue(
          (prof as any).addressDetails || (prof as any).addresses?.[0] || prof.address,
        ),
      );
      setTempBio(prof.bio || '');
      setTempIsCertified(Boolean(prof.isCertified));
      if (prof.avatarUrl) {
        setTempAvatarUrl(prof.avatarUrl);
        setAvatarLoadError(false);
      } else if (u?.avatarUrl) {
        setTempAvatarUrl(u.avatarUrl);
        setAvatarLoadError(false);
      }
      if ((prof as any).bannerUrl) {
        setTempBannerUrl((prof as any).bannerUrl);
        setBannerLoadError(false);
      }
    }
  }, [profile, user]);

  useEffect(() => {
    syncFormState();
  }, [syncFormState]);

  const handleOpenEdit = () => {
    syncFormState();
    setIsEditing(true);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP)', 'error');
      return;
    }

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setTempAvatarUrl(localPreview);
    setAvatarLoadError(false);

    try {
      setIsUploadingAvatar(true);
      const uploadedUrl = await uploadMediaFile(file);
      if (uploadedUrl) {
        setTempAvatarUrl(uploadedUrl);
        setAvatarLoadError(false);

        // Save avatar to profile
        if (user?.id) {
          await updateUserMutation.mutateAsync({
            id: user.id,
            avatarUrl: uploadedUrl,
          });
          addToast('Photo de profil mise à jour !', 'success');
          updateAuthUser({ avatarUrl: uploadedUrl } as any);
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          void refetchProfile();
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erreur lors du téléchargement de l'image";
      addToast(msg, 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP)', 'error');
      return;
    }

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setTempBannerUrl(localPreview);
    setBannerLoadError(false);

    try {
      setIsUploadingBanner(true);
      const uploadedUrl = await uploadMediaFile(file);
      if (uploadedUrl) {
        setTempBannerUrl(uploadedUrl);
        setBannerLoadError(false);

        // Save banner to profile
        if (user?.id) {
          await updateUserMutation.mutateAsync({
            id: user.id,
            bannerUrl: uploadedUrl,
          });
          addToast('Bannière mise à jour avec succès !', 'success');
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          void refetchProfile();
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erreur lors du téléchargement de la bannière";
      addToast(msg, 'error');
    } finally {
      setIsUploadingBanner(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (!tempName.trim()) {
      addToast("Le nom de l'exploitation est requis.", 'warning');
      return;
    }
    if (!user?.id) return;

    updateUserMutation.mutate(
      {
        id: user.id,
        firstName: tempFirstName.trim(),
        lastName: tempLastName.trim(),
        email: tempEmail.trim(),
        phoneNumber: tempPhone.trim(),
        companyName: tempName.trim(),
        addressDetails: tempAddress,
        bio: tempBio.trim() || undefined,
        isCertified: tempIsCertified,
        avatarUrl: tempAvatarUrl || undefined,
        bannerUrl: tempBannerUrl || undefined,
      },
      {
        onSuccess: async () => {
          addToast('Profil mis à jour avec succès.', 'success');
          updateAuthUser({
            firstName: tempFirstName.trim(),
            lastName: tempLastName.trim(),
            email: tempEmail.trim(),
            phoneNumber: tempPhone.trim() || null,
            avatarUrl: tempAvatarUrl || undefined,
          } as any);
          setIsEditing(false);
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          void refetchProfile();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Erreur lors de la mise à jour du profil';
          addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        },
      },
    );
  };

  // Calculations
  const harvests = isOwner ? ownerHarvests : publicHarvests;
  const approvedHarvests = harvests
    ? harvests.filter((h) => h.status === 'APPROVED' || !h.status)
    : [];

  const averageQuality =
    approvedHarvests.length && approvedHarvests.some((h) => h.qualityScore)
      ? Math.round(
          (approvedHarvests.reduce((sum, h) => sum + (h.qualityScore || 0), 0) /
            approvedHarvests.filter((h) => h.qualityScore).length) *
            10,
        )
      : 92;

  const totalRevenue = orders
    ? orders
        .filter((o) => o.status === 'CONFIRMED' || o.status === 'DELIVERED')
        .reduce((sum, o) => sum + o.totalPrice, 0)
    : 0;

  const productsCount = approvedHarvests.length;
  const ordersCount = orders ? orders.length : 0;

  const producerDisplayName =
    profile?.companyName ||
    (profile?.user ? `${profile.user.firstName} ${profile.user.lastName}`.trim() : '') ||
    (isOwner && user ? `${user.firstName} ${user.lastName}` : 'Exploitation Agricole');

  const fallbackAvatarSrc = `https://ui-avatars.com/api/?name=${encodeURIComponent(producerDisplayName)}&background=004322&color=fff&bold=true`;
  const fallbackBannerSrc = 'https://images.unsplash.com/photo-1500937386664-56d1590d333c?w=600';

  const rawAvatarSrc =
    tempAvatarUrl ||
    profile?.avatarUrl ||
    (profile?.user as any)?.avatarUrl ||
    (isOwner && user?.avatarUrl) ||
    null;

  const rawBannerSrc =
    tempBannerUrl ||
    (profile as any)?.bannerUrl ||
    null;

  useEffect(() => {
    setAvatarLoadError(false);
  }, [rawAvatarSrc]);

  useEffect(() => {
    setBannerLoadError(false);
  }, [rawBannerSrc]);

  const currentAvatarSrc =
    !avatarLoadError && rawAvatarSrc ? rawAvatarSrc : fallbackAvatarSrc;

  const currentBannerSrc =
    !bannerLoadError && rawBannerSrc ? rawBannerSrc : fallbackBannerSrc;

  if (isLoadingProfile) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-1 -ml-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center cursor-pointer"
            aria-label="Retour"
          >
            <Icon name="arrow_back" size={24} />
          </button>
          <span className="text-sm font-bold text-[#0b1c30]">Chargement du profil...</span>
          <div className="w-8" />
        </header>
        <main className="pt-20 px-4 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 border-4 border-[#004322] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#707970]">Récupération des données producteur...</p>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-1 -ml-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center cursor-pointer"
            aria-label="Retour"
          >
            <Icon name="arrow_back" size={24} />
          </button>
          <span className="text-sm font-bold text-[#0b1c30]">Profil introuvable</span>
          <div className="w-8" />
        </header>
        <main className="pt-20 px-4 text-center">
          <div className="bg-white rounded-2xl p-6 border border-[#c0c9be]/50 shadow-sm max-w-sm mx-auto">
            <Icon name="person_off" size={40} className="text-gray-400 mb-2 mx-auto" />
            <p className="text-sm font-bold text-[#0b1c30]">Profil introuvable</p>
            <p className="text-xs text-[#707970] mt-1">Le producteur demandé n&apos;existe pas ou a été archivé.</p>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="mt-4 inline-block px-4 py-2 bg-[#004322] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Retour
            </button>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div
      data-testid="farmer-profile-container"
      className={`bg-[#f8f9ff] text-[#0b1c30] font-sans min-h-screen ${
        isOwner ? 'pb-24' : 'pb-10'
      }`}
    >
      {/* Top Header matching mockup */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          {!isOwner && (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="p-1 -ml-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center cursor-pointer transition-colors"
              aria-label="Retour"
            >
              <Icon name="arrow_back" size={24} />
            </button>
          )}
          <div className="flex items-center gap-2 text-[#004322] font-black text-base">
            <Icon name="agriculture" size={24} />
            <span>Future Farm</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="w-8 h-8 rounded-full bg-[#004322] text-white text-xs font-bold flex items-center justify-center border border-emerald-200">
              {user.firstName?.[0] || 'U'}
            </div>
          )}
        </div>
      </header>

      {/* Hidden File Input for Avatar Upload */}
      {isOwner && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleAvatarFileChange}
          className="hidden"
        />
      )}

      {/* Hidden File Input for Banner Upload */}
      {isOwner && (
        <input
          ref={bannerFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleBannerFileChange}
          className="hidden"
        />
      )}

      <main className="max-w-[480px] mx-auto pb-8">
        {/* Hero Section: Banner & Profile Photo */}
        <section className="relative group/banner">
          <div className="h-48 w-full bg-[#e5eeff] overflow-hidden relative">
            <img
              className="w-full h-full object-cover"
              alt="Farm Banner"
              src={currentBannerSrc}
              onError={() => setBannerLoadError(true)}
            />
            {/* Upload Banner Button (Only for owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => bannerFileInputRef.current?.click()}
                disabled={isUploadingBanner}
                className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-xs transition-opacity cursor-pointer shadow-sm opacity-90 hover:opacity-100"
                title="Modifier l'image de couverture"
              >
                <Icon
                  name={isUploadingBanner ? 'hourglass_top' : 'add_photo_alternate'}
                  size={16}
                  className={isUploadingBanner ? 'animate-spin' : ''}
                />
                <span>{isUploadingBanner ? 'Envoi...' : 'Changer la bannière'}</span>
              </button>
            )}
          </div>
          <div className="px-4 -mt-12 relative z-10">
            <div className="flex items-end justify-between">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-[#f8f9ff] bg-[#ffffff] overflow-hidden shadow-sm relative">
                  <img
                    className="w-full h-full object-cover"
                    alt={producerDisplayName}
                    src={currentAvatarSrc}
                    onError={() => setAvatarLoadError(true)}
                  />
                  {/* Upload Avatar Overlay Button (Only for owner) */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
                      title="Changer la photo de profil"
                    >
                      <Icon
                        name={isUploadingAvatar ? 'hourglass_top' : 'photo_camera'}
                        size={20}
                        className={isUploadingAvatar ? 'animate-spin' : ''}
                      />
                      <span className="text-[9px] font-bold mt-0.5">
                        {isUploadingAvatar ? 'Envoi...' : 'Modifier'}
                      </span>
                    </button>
                  )}
                </div>
                {profile.isCertified && (
                  <div className="absolute bottom-0 right-0 bg-[#004322] text-white rounded-full p-1 border-2 border-[#f8f9ff] shadow-2xs">
                    <Icon name="verified" size={16} className="block" />
                  </div>
                )}
              </div>

              {/* Action on right: Edit button for owner */}
              {isOwner && (
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="bg-[#004322] hover:bg-[#00331a] text-white px-4 py-2 rounded-lg font-semibold text-[12px] flex items-center gap-2 active:scale-95 transition-all cursor-pointer shadow-xs"
                  >
                    <Icon name="edit" size={16} />
                    Modifier le profil
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Identity & Stats Section */}
        <section className="px-4 mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-extrabold text-[#0b1c30]">
              {producerDisplayName}
            </h1>
            {profile.isCertified && (
              <Icon
                name="verified"
                size={20}
                className="text-[#004322]"
              />
            )}
          </div>
          <p className="text-[14px] text-[#404941] mt-1 leading-relaxed">
            {profile.bio ||
              "Producteur engagé pour une agriculture durable et des produits de qualité supérieure."}
          </p>

          {/* Stats Grid: 2 columns for public visitor, 4 columns for owner */}
          {!isOwner ? (
            <div className="grid grid-cols-2 gap-4 mt-6 bg-[#eff4ff] p-4 rounded-xl border border-[#c0c9be] shadow-xs">
              <div className="text-center">
                <p className="text-[22px] font-black text-[#004322]">{productsCount}</p>
                <p className="text-xs font-semibold text-[#404941]">Produits</p>
              </div>
              <div className="text-center">
                <p className="text-[22px] font-black text-[#004322]">{averageQuality}%</p>
                <p className="text-xs font-semibold text-[#404941]">Qualité</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 mt-6 bg-[#eff4ff] p-4 rounded-xl border border-[#c0c9be] shadow-xs">
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
                <p className="text-[16px] font-semibold text-[#004322] truncate">
                  {totalRevenue.toLocaleString('fr-FR')}
                </p>
                <p className="text-[11px] text-[#404941]">FCFA</p>
              </div>
            </div>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => void navigate({ to: '/farmer/harvests/analyze' })}
              className="w-full mt-3 border border-[#707970] text-[#004322] font-semibold text-[12px] py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-[#d3e4fe]/20 transition-colors cursor-pointer"
            >
              <Icon name="analytics" size={18} />
              Voir les analyses de lots
            </button>
          )}
        </section>

        {/* Active Products / Listings Section */}
        <section className="px-4 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-[#0b1c30]">Lots actifs</h3>
            {isOwner ? (
              <Link
                to="/farmer/stock"
                className="text-[#004322] font-semibold text-[12px] hover:underline cursor-pointer"
              >
                Gérer stock
              </Link>
            ) : (
              <Link
                to="/marketplace"
                className="text-[#004322] font-semibold text-[12px] hover:underline cursor-pointer"
              >
                Tout voir
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {approvedHarvests.length === 0 ? (
              <div className="bg-white border border-[#c0c9be] rounded-xl p-6 text-center text-[#404941] text-xs">
                Aucun lot récolté actif pour le moment.
              </div>
            ) : (
              approvedHarvests.map((h) => (
                <Link
                  key={h.id}
                  to="/harvests/$id"
                  params={{ id: h.id }}
                  className="bg-white border border-[#c0c9be] hover:border-[#004322] rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-xs transition-all block cursor-pointer"
                >
                  <div className="flex gap-3.5 items-center">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-gray-100">
                      <img
                        className="w-full h-full object-cover"
                        alt={h.product?.name ?? 'Récolte'}
                        src={
                          h.photoUrls?.[0] ||
                          'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=200'
                        }
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <h4 className="text-sm font-bold text-[#0b1c30] truncate">
                          {h.product?.name}
                        </h4>
                        <span className="bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0">
                          {h.qualityScore ? Math.round(h.qualityScore * 10) : 92}% QUALITÉ
                        </span>
                      </div>
                      <p className="text-[10px] text-[#004322] font-extrabold uppercase tracking-wider mt-0.5">
                        {CATEGORY_LABEL[h.product?.category ?? ''] || h.product?.category || 'MARAÎCHAGE'}
                      </p>
                      <p className="text-xs font-bold text-[#0b1c30] mt-1 truncate">
                        Stock total : {h.quantityInStock?.toLocaleString('fr-FR')}{' '}
                        {h.unit?.toLowerCase()}
                      </p>
                      <p className="text-[11px] text-[#707970] mt-0.5 truncate">
                        Dernière récolte : {formatHarvestDate(h.harvestDate || h.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Divider & Recent history badges */}
                  <div className="h-px bg-[#f1f5f9] my-0.5" />
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[10px] font-bold text-[#707970]">
                      Historique récent :
                    </span>
                    <span className="bg-[#eff6ff] text-[#1e40af] text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                      {formatMonth(h.harvestDate || h.createdAt)}:{' '}
                      {h.qualityScore ? Math.round(h.qualityScore * 10) : 92}
                    </span>
                    <span className="bg-[#eff6ff] text-[#1e40af] text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                      Conforme: 100%
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Account & Logout Section (Only for owner) */}
        {isOwner && (
          <section className="px-4 mt-8">
            <div className="bg-white border border-[#c0c9be] rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#404941]">
                Compte & Sécurité
              </h3>
              <button
                type="button"
                onClick={() => {
                  clearAuth();
                  void navigate({ to: '/auth/login' });
                }}
                className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="logout" size={18} />
                Déconnexion
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Edit Profile Modal (Only for owner) */}
      {isOwner && isEditing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[480px] p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-[18px] font-bold text-[#004322] flex items-center gap-2">
                <Icon name="edit_note" size={22} className="text-[#004322]" />
                Modifier le profil
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* Media Uploads in modal */}
            <div className="grid grid-cols-2 gap-3">
              {/* Avatar upload */}
              <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <img
                  src={currentAvatarSrc}
                  alt="Avatar preview"
                  onError={() => setAvatarLoadError(true)}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#004322] shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-800 truncate">Photo profil</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="mt-0.5 text-[11px] text-[#004322] font-bold underline hover:text-[#002b15] cursor-pointer block truncate"
                  >
                    {isUploadingAvatar ? 'Envoi...' : 'Modifier'}
                  </button>
                </div>
              </div>

              {/* Banner upload */}
              <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <img
                  src={currentBannerSrc}
                  alt="Banner preview"
                  onError={() => setBannerLoadError(true)}
                  className="w-12 h-12 rounded-lg object-cover border border-gray-300 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-gray-800 truncate">Bannière</p>
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="mt-0.5 text-[11px] text-[#004322] font-bold underline hover:text-[#002b15] cursor-pointer block truncate"
                  >
                    {isUploadingBanner ? 'Envoi...' : 'Modifier'}
                  </button>
                </div>
              </div>
            </div>

            {/* General Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Prénom</label>
                <input
                  className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-2.5 text-[13px] outline-none"
                  value={tempFirstName}
                  onChange={(e) => setTempFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Nom</label>
                <input
                  className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-2.5 text-[13px] outline-none"
                  value={tempLastName}
                  onChange={(e) => setTempLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Email</label>
                <input
                  type="email"
                  className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-2.5 text-[13px] outline-none"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#404941] block">Téléphone</label>
                <input
                  type="tel"
                  placeholder="+221..."
                  className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-2.5 text-[13px] outline-none"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Farm Info */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Nom de l'exploitation</label>
              <input
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-2.5 text-[13px] outline-none"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                required
              />
            </div>

            {/* Address of the exploitation */}
            <div className="pt-2 border-t border-gray-100">
              <AddressInputGroup
                value={tempAddress}
                onChange={setTempAddress}
                title="Adresse de l'exploitation"
                subtitle="Localisation principale de la ferme"
                required={false}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] block">Bio / Présentation</label>
              <textarea
                rows={2}
                placeholder="Décrivez brièvement votre exploitation..."
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-2.5 text-[13px] outline-none"
                value={tempBio}
                onChange={(e) => setTempBio(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={tempIsCertified}
                onChange={(e) => setTempIsCertified(e.target.checked)}
                className="rounded border-[#c0c9be] text-[#004322] focus:ring-[#004322]"
              />
              <span className="text-[12px] font-semibold text-[#0b1c30]">
                Exploitation certifiée Bio (Label vérifié)
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-[#707970] rounded-lg text-[12px] font-semibold text-[#404941] hover:bg-[#eff4ff] cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateUserMutation.isPending}
                className="px-5 py-2 bg-[#004322] text-white rounded-lg text-[12px] font-bold hover:bg-[#004322]/90 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {updateUserMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
