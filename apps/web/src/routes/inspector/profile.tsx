import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth, updateAuthUser } from '@/features/auth/store/auth.store';
import { changePasswordMutation } from '@/features/auth/api/auth.queries';
import { useUser, useUpdateUser } from '@/features/admin/api/users.queries';
import { useMyCenters, useMyCenter } from '@/features/admin/api/inspections.queries';
import { uploadMediaFile } from '@/features/profile/api/profile.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { Button } from '@/features/admin/components';

export const Route = createFileRoute('/inspector/profile')({
  component: InspectorProfilePage,
});

export function InspectorProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: userDetails, refetch: refetchUser } = useUser(user?.id || '');
  const { data: myCenters = [] } = useMyCenters();
  const { data: myCenter } = useMyCenter();
  const updateUser = useUpdateUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [activeTab, setActiveTab] = useState<'info' | 'stations' | 'security'>('info');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });

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

  useEffect(() => {
    if (userDetails) {
      setFormData({
        firstName: userDetails.firstName || '',
        lastName: userDetails.lastName || '',
        email: userDetails.email || '',
        phoneNumber: userDetails.phoneNumber || (userDetails as any).phone || '',
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
      },
      {
        onSuccess: () => {
          addToast('Vos informations d\'inspecteur ont été enregistrées.', 'success');
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

  const assignedStations = myCenters.length > 0 ? myCenters : myCenter ? [myCenter] : [];
  const currentAvatarUrl = (userDetails as any)?.avatarUrl || user?.avatarUrl;

  return (
    <div className="min-h-screen bg-[#f8faf8] pb-24">
      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/inspector/dashboard"
              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Icon name="arrow_back" className="text-xl" />
            </Link>
            <div>
              <span className="text-[11px] font-bold text-[#1a5c35] uppercase tracking-wider">Espace Inspecteur</span>
              <h1 className="text-lg font-bold text-[#0b1c30]">Mon Profil & Paramètres</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icon name="logout" className="text-sm" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Temporary Password Alert */}
        {user?.mustChangePassword && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-amber-900 shadow-sm animate-slide-in">
            <Icon name="warning" className="text-2xl text-amber-600 shrink-0" />
            <div className="flex-1 text-xs sm:text-sm">
              <p className="font-bold">Mot de passe temporaire actif</p>
              <p className="text-amber-800">
                Vous êtes connecté avec un mot de passe temporaire. Veuillez le modifier dans l'onglet Sécurité.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('security')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Changer
            </button>
          </div>
        )}

        {/* Profile Identity Card */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-[#1a5c35] text-white flex items-center justify-center font-bold text-2xl shadow-xs uppercase overflow-hidden border-2 border-emerald-100">
              {currentAvatarUrl ? (
                <img
                  src={currentAvatarUrl}
                  alt={user?.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {user?.firstName?.charAt(0) || 'I'}
                  {user?.lastName?.charAt(0) || ''}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white disabled:opacity-50"
              title="Modifier la photo de profil"
            >
              <Icon name={isUploadingAvatar ? 'sync' : 'photo_camera'} className="text-xs" />
            </button>
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-[#1a5c35]">
                Inspecteur Qualité Certifié
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                Compte Actif
              </span>
              {assignedStations.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {assignedStations.length} station{assignedStations.length > 1 ? 's' : ''} assignée{assignedStations.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'info'
                ? 'border-[#1a5c35] text-[#1a5c35]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon name="badge" className="text-lg" />
            Informations Inspecteur
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stations')}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'stations'
                ? 'border-[#1a5c35] text-[#1a5c35]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon name="corporate_fare" className="text-lg" />
            Stations d'Inspection ({assignedStations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-[#1a5c35] text-[#1a5c35]'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon name="lock" className="text-lg" />
            Sécurité & Mot de passe
          </button>
        </div>

        {/* Tab 1: Informations Inspecteur */}
        {activeTab === 'info' && (
          <form onSubmit={handleSaveInfo} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <Icon name="person" className="text-[#1a5c35]" />
                Coordonnées Générales
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35]"
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
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35]"
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
                    Numéro de téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35]"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateUser.isPending}
                  className="bg-[#1a5c35] hover:bg-[#144729] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xs"
                >
                  {updateUser.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Stations d'inspection */}
        {activeTab === 'stations' && (
          <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Icon name="corporate_fare" className="text-[#1a5c35]" />
                  Stations d'Inspection Assignées
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Centres régionaux pour lesquels vous êtes habilité à réaliser des audits qualité.
                </p>
              </div>
              <Link
                to="/inspector/my-center"
                className="text-xs font-bold text-[#1a5c35] hover:underline flex items-center gap-1"
              >
                Gérer ma station →
              </Link>
            </div>

            {assignedStations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignedStations.map((center) => (
                  <div
                    key={center.id}
                    className="bg-[#f8faf8] border border-gray-200 rounded-2xl p-4 space-y-2 hover:border-[#1a5c35]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900">{center.name}</span>
                      <span className="font-mono text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-[#1a5c35] font-bold">
                        {center.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold bg-emerald-100 text-[#1a5c35] px-2 py-0.5 rounded-full">
                        {center.regionName}
                      </span>
                      <span className="text-[10px] font-medium text-gray-500">
                        {center.isActive !== false ? 'Station Active' : 'Station Inactive'}
                      </span>
                    </div>

                    {center.address && (
                      <p className="text-xs text-gray-600 flex items-start gap-1 pt-1">
                        <Icon name="location_on" className="text-sm text-gray-400 shrink-0" />
                        <span>{center.address}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <Icon name="domain_disabled" className="text-gray-400 text-3xl" />
                <p className="text-xs text-gray-500 mt-2">Aucun centre d'inspection assigné.</p>
                <p className="text-[11px] text-gray-400">Veuillez contacter un administrateur pour votre affectation.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sécurité & Mot de passe */}
        {activeTab === 'security' && (
          <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                <Icon name="lock" className="text-[#1a5c35]" />
                Changer de mot de passe
              </h3>

              <div className="max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35]"
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
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35]"
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
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35]"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={changePassword.isPending}
                    className="bg-[#1a5c35] hover:bg-[#144729] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-xs"
                  >
                    {changePassword.isPending ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
