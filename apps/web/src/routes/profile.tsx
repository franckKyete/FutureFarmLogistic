import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth, updateAuthUser } from '@/features/auth/store/auth.store';
import { changePasswordMutation } from '@/features/auth/api/auth.queries';
import { useUser, useUpdateUser } from '@/features/admin/api/users.queries';
import { uploadMediaFile } from '@/features/profile/api/profile.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { Button } from '@/features/admin/components';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import { AddressSelector } from '@/features/addresses/components';

export const Route = createFileRoute('/profile')({
  component: BuyerProfilePage,
});

export function BuyerProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect role-specific users to their dedicated profile URLs
  useEffect(() => {
    if (!user) return;
    if (user.roles?.includes('Inspector')) {
      void navigate({ to: '/inspector/profile' });
    } else if (user.roles?.includes('Driver')) {
      void navigate({ to: '/driver/profile' });
    } else if (user.roles?.includes('Farmer') && !user.roles?.includes('Buyer')) {
      void navigate({ to: '/farmer/profile' });
    }
  }, [user, navigate]);

  const { data: userDetails, refetch: refetchUser } = useUser(user?.id || '');
  const updateUser = useUpdateUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Form states
  const [activeTab, setActiveTab] = useState<'info' | 'addresses' | 'security'>('info');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    vatNumber: '',
    shippingAddress: '',
    billingAddress: '',
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    ...changePasswordMutation(),
    onSuccess: (data) => {
      addToast(data.message || 'Mot de passe modifié avec succès !', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      updateAuthUser({ mustChangePassword: false });
    },
    onError: (err: any) => {
      addToast(err?.response?.data?.message || 'Erreur lors du changement de mot de passe', 'error');
    },
  });

  // Populate formData on fetch
  useEffect(() => {
    if (userDetails) {
      const prof = (userDetails as any).profile || (userDetails as any).buyerProfile || {};
      setFormData({
        firstName: userDetails.firstName || '',
        lastName: userDetails.lastName || '',
        email: userDetails.email || '',
        phoneNumber: userDetails.phoneNumber || (userDetails as any).phone || '',
        companyName: prof.companyName || '',
        vatNumber: prof.vatNumber || '',
        shippingAddress: prof.shippingAddress || '',
        billingAddress: prof.billingAddress || '',
      });
    } else if (user) {
      setFormData((prev) => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      }));
    }
  }, [userDetails, user]);

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    updateUser.mutate(
      {
        id: user.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        companyName: formData.companyName || undefined,
        vatNumber: formData.vatNumber || undefined,
        shippingAddress: formData.shippingAddress || undefined,
        billingAddress: formData.billingAddress || undefined,
      },
      {
        onSuccess: () => {
          addToast('Vos informations de profil ont été enregistrées.', 'success');
          updateAuthUser({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
          });
          void refetchUser();
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Erreur lors de la mise à jour.';
          addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        },
      },
    );
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      addToast('Veuillez saisir votre mot de passe actuel.', 'warning');
      return;
    }
    if (newPassword.length < 8) {
      addToast('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Les nouveaux mots de passe ne correspondent pas.', 'warning');
      return;
    }

    changePassword.mutate({
      currentPassword,
      newPassword,
    });
  };

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
      if (user?.id) {
        await updateUser.mutateAsync({
          id: user.id,
          avatarUrl: uploadedUrl,
        });
        addToast('Photo de profil mise à jour avec succès !', 'success');
        updateAuthUser({ avatarUrl: uploadedUrl } as any);
        void refetchUser();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erreur lors du téléchargement de l'image";
      addToast(msg, 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    clearAuth();
    void navigate({ to: '/auth/login' });
  };

  const currentAvatarUrl = (userDetails as any)?.avatarUrl || (userDetails as any)?.profile?.avatarUrl || user?.avatarUrl;

  return (
    <div className="min-h-screen bg-[#f8f9ff] pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <BuyerHeader title="Mon Profil" showBack backTo="/marketplace" />
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hidden File Input for Avatar */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAvatarFileChange}
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
        />

        {/* Temporary Password Warning Banner */}
        {user?.mustChangePassword && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-amber-900 shadow-sm animate-slide-in">
            <Icon name="warning" className="text-2xl text-amber-600 shrink-0" />
            <div className="flex-1 text-xs sm:text-sm">
              <p className="font-bold">Mot de passe temporaire actif</p>
              <p className="text-amber-800">
                Vous êtes connecté avec un mot de passe temporaire. Veuillez le modifier ci-dessous dans l'onglet Sécurité pour sécuriser votre compte.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('security')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Changer maintenant
            </button>
          </div>
        )}

        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-2xl shadow-sm uppercase overflow-hidden border-2 border-emerald-100">
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt={user?.firstName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {user?.firstName?.charAt(0) || 'A'}
                    {user?.lastName?.charAt(0) || ''}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#004322] text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white disabled:opacity-50"
                title="Modifier la photo de profil"
              >
                <Icon name={isUploadingAvatar ? 'sync' : 'photo_camera'} className="text-sm" />
              </button>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h1>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#004322] uppercase tracking-wider">
                  Acheteur Enregistré
                </span>
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                  Compte Actif
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            <Icon name="logout" className="text-base" />
            Se déconnecter
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'info'
                ? 'border-[#004322] text-[#004322]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon name="person" className="text-lg" />
            Mes informations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('addresses')}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'addresses'
                ? 'border-[#004322] text-[#004322]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon name="location_on" className="text-lg" />
            Mes adresses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-[#004322] text-[#004322]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon name="lock" className="text-lg" />
            Sécurité & Mot de passe
          </button>
          <Link
            to="/payment-method"
            className="pb-3 px-2 text-sm font-bold transition-all border-b-2 border-transparent text-gray-500 hover:text-[#004322] cursor-pointer flex items-center gap-2 ml-auto"
          >
            <Icon name="credit_card" className="text-lg" />
            Moyen de paiement
          </Link>
        </div>

        {/* Tab 1: Personal & Buyer Information */}
        {activeTab === 'info' && (
          <form onSubmit={handleSaveInfo} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <Icon name="badge" className="text-[#004322]" />
                Coordonnées Générales
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Adresse Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3.5 py-2.5 border border-gray-200 bg-gray-50 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Numéro de téléphone <span className="text-gray-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="Non renseigné"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Icon name="storefront" className="text-[#004322]" />
                  Informations Entreprise & Facturation
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de l'entreprise (optionnel)</label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="Ex: SARL Agro Import"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">N° TVA / Registre du commerce</label>
                      <input
                        type="text"
                        value={formData.vatNumber}
                        onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                        placeholder="Non renseigné"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse de livraison par défaut</label>
                    <input
                      type="text"
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                      placeholder="Non renseignée"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateUser.isPending}
                  className="bg-[#004322] hover:bg-[#003319] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm"
                >
                  {updateUser.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Saved Addresses */}
        {activeTab === 'addresses' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Icon name="location_on" className="text-[#004322]" />
              Carnet d'adresses
            </h2>
            <p className="text-xs text-gray-500">
              Gérez vos adresses de livraison et d'enlèvement enregistrées.
            </p>
            <AddressSelector
              onSelectAddress={() => {}}
              title="Mes adresses enregistrées"
              showActions
            />
          </div>
        )}

        {/* Tab 3: Security & Change Password */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <Icon name="lock" className="text-[#004322]" />
                Changer de mot de passe
              </h2>

              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nouveau mot de passe <span className="text-gray-400 font-normal">(min. 8 caractères)</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={changePassword.isPending}
                    className="bg-[#004322] hover:bg-[#003319] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-sm"
                  >
                    {changePassword.isPending ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
