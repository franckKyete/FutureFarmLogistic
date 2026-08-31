import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth, updateAuthUser } from '@/features/auth/store/auth.store';
import { changePasswordMutation } from '@/features/auth/api/auth.queries';
import { useUser, useUpdateUser } from '@/features/admin/api/users.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { Button } from '@/features/admin/components';

export const Route = createFileRoute('/profile')({
  component: UnifiedProfilePage,
});

const ROLE_FRENCH: Record<string, string> = {
  Farmer: 'Producteur',
  Buyer: 'Acheteur',
  Inspector: 'Inspecteur',
  Admin: 'Administrateur',
  Driver: 'Chauffeur',
};

function getFrenchRole(roleName: string): string {
  return ROLE_FRENCH[roleName] ?? roleName;
}

function UnifiedProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: userDetails, refetch: refetchUser } = useUser(user?.id || '');
  const updateUser = useUpdateUser();

  // Form states
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    licenseNumber: '',
    licenseCategory: 'B',
    agencyName: '',
    companyName: '',
    address: '',
    bio: '',
    vatNumber: '',
    billingAddress: '',
    shippingAddress: '',
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    ...changePasswordMutation(),
    onSuccess: (data) => {
      addToast(data.message || 'Mot de passe modifié avec succès.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      updateAuthUser({ mustChangePassword: false });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'users', user.id] });
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors du changement de mot de passe.';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({ to: '/auth/login' });
      return;
    }

    const current = userDetails || user;
    if (current) {
      const prof = (current as any).profile || {};
      setFormData({
        firstName: current.firstName || '',
        lastName: current.lastName || '',
        email: current.email || '',
        phoneNumber: (current as any).phone || (current as any).phoneNumber || '',
        licenseNumber: prof.licenseNumber || '',
        licenseCategory: prof.licenseCategory || 'B',
        agencyName: prof.agencyName || '',
        companyName: prof.companyName || '',
        address: prof.address || '',
        bio: prof.bio || '',
        vatNumber: prof.vatNumber || '',
        billingAddress: prof.billingAddress || '',
        shippingAddress: prof.shippingAddress || '',
      });
    }
  }, [userDetails, user, isAuthenticated, navigate]);

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    updateUser.mutate(
      {
        id: user.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        licenseNumber: formData.licenseNumber || undefined,
        licenseCategory: formData.licenseCategory || undefined,
        agencyName: formData.agencyName || undefined,
        companyName: formData.companyName || undefined,
        address: formData.address || undefined,
        bio: formData.bio || undefined,
        vatNumber: formData.vatNumber || undefined,
        billingAddress: formData.billingAddress || undefined,
        shippingAddress: formData.shippingAddress || undefined,
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

  const handleLogout = () => {
    clearAuth();
    void navigate({ to: '/auth/login' });
  };

  const primaryRole = user?.roles?.[0] || 'Utilisateur';

  return (
    <div className="min-h-screen bg-[#f8f9ff] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Temporary Password Warning Banner */}
        {user?.mustChangePassword && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-amber-900 shadow-sm animate-slide-in">
            <span className="material-symbols-outlined text-2xl text-amber-600 shrink-0">warning</span>
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
            <div className="w-20 h-20 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-2xl shadow-sm uppercase shrink-0">
              {user?.firstName?.charAt(0) || 'U'}
              {user?.lastName?.charAt(0) || ''}
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h1>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#004322] uppercase tracking-wider">
                  {getFrenchRole(primaryRole)}
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
            <span className="material-symbols-outlined text-base">logout</span>
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
            <span className="material-symbols-outlined text-lg">person</span>
            Mes informations
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
            <span className="material-symbols-outlined text-lg">lock</span>
            Sécurité & Mot de passe
          </button>
        </div>

        {/* Tab 1: Personal & Role Information */}
        {activeTab === 'info' && (
          <form onSubmit={handleSaveInfo} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004322]">badge</span>
                Coordonnées générales
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro de téléphone</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="Non renseigné"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                  />
                </div>
              </div>

              {/* Role Specific Section */}
              {primaryRole === 'Driver' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#004322]">local_shipping</span>
                    Informations Chauffeur
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro de Permis</label>
                      <input
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        placeholder="Non renseigné"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
                      <select
                        value={formData.licenseCategory}
                        onChange={(e) => setFormData({ ...formData, licenseCategory: e.target.value })}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      >
                        <option value="B">Permis B (Véhicule léger)</option>
                        <option value="C">Permis C (Poids lourd)</option>
                        <option value="C1">Permis C1</option>
                        <option value="CE">Permis CE (Semi-remorque)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {primaryRole === 'Inspector' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#004322]">verified_user</span>
                    Informations Inspecteur
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Agence / Entreprise</label>
                      <input
                        type="text"
                        value={formData.agencyName}
                        onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                        placeholder="Non renseignée"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Numéro d'agrément</label>
                      <input
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        placeholder="Non renseigné"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {primaryRole === 'Farmer' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#004322]">agriculture</span>
                    Informations Exploitation
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de l'exploitation</label>
                      <input
                        type="text"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="Non renseigné"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse de la ferme</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Non renseignée"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Présentation / Bio</label>
                      <textarea
                        rows={3}
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        placeholder="Non renseignée"
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {primaryRole === 'Buyer' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#004322]">storefront</span>
                    Informations Entreprise & Livraison
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de l'entreprise</label>
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="Non renseigné"
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#004322]/20 focus:border-[#004322]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">N° TVA / Registre</label>
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
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse de livraison</label>
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
              )}

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

        {/* Tab 2: Security & Change Password */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004322]">lock</span>
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
