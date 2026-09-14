import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyDriverProfileQuery,
  getMyRunsQuery,
  updateDriverAvailabilityMutation,
  updateMyDriverProfileMutation,
} from '@/features/tracking/api/tracking.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth, updateAuthUser } from '@/features/auth/store/auth.store';
import { addToast } from '@/features/shared/store/toast.store';
import { DeliveryRunStatus } from '@futurefarm/types';

export const Route = createFileRoute('/driver/profile')({
  component: DriverProfilePage,
});

type ProfileTab = 'info' | 'documents' | 'reviews';

export function DriverProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ProfileTab>('info');
  const [selectedDays, setSelectedDays] = useState<string[]>(['L', 'M', 'M2', 'J', 'V']);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: profile } = useQuery(getMyDriverProfileQuery());
  const { data: runs = [] } = useQuery(getMyRunsQuery());

  const updateAvailability = useMutation({
    ...updateDriverAvailabilityMutation(),
    onSuccess: (data) => {
      addToast(
        data?.isAvailable ? 'Vous êtes maintenant disponible' : 'Statut mis à jour : en pause',
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['driver', 'profile', 'me'] });
    },
    onError: () => addToast('Erreur lors de la mise à jour du statut', 'error'),
  });

  const isAvailable = profile?.isAvailable ?? true;
  const vehicle = profile?.vehicle;

  // Compute real metrics from runs & profile
  const completedRuns = runs.filter((r) => r.status === DeliveryRunStatus.COMPLETED);
  const totalDeliveries = profile?.totalDeliveriesCompleted ?? completedRuns.length;
  const totalDistanceKm = runs
    .filter((r) => r.status === DeliveryRunStatus.COMPLETED)
    .reduce((acc, r) => acc + (Number(r.totalDistanceKm) || 0), 0);
  
  const totalFinishedRuns = runs.filter(
    (r) => r.status === DeliveryRunStatus.COMPLETED || r.status === DeliveryRunStatus.CANCELLED,
  ).length;
  const successRate =
    totalFinishedRuns > 0
      ? `${Math.round((completedRuns.length / totalFinishedRuns) * 100)}%`
      : '100%';

  // Toggle availability schedule day
  const toggleDay = (dayKey: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey],
    );
  };

  const daysOfWeek = [
    { key: 'L', label: 'L' },
    { key: 'M', label: 'M' },
    { key: 'M2', label: 'M' },
    { key: 'J', label: 'J' },
    { key: 'V', label: 'V' },
    { key: 'S', label: 'S' },
    { key: 'D', label: 'D' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#fbfbfe] pb-24">
      {/* Top Header */}
      <header className="bg-white px-4 py-3.5 border-b border-gray-100 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <Link to="/driver" className="p-1 text-[#004322] hover:bg-gray-100 rounded-lg">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <h1 className="font-extrabold text-base text-[#0b1c30]">Mon profil</h1>
        </div>

        <button
          type="button"
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-black bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
        >
          <Icon name="edit" className="text-sm" />
          <span>Modifier</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4 flex-1">
        {/* Profile Card with Photo and verified badge */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="relative">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.firstName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-2xl border-2 border-white shadow-md">
                {user?.firstName?.charAt(0) || 'C'}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white">
              ✓
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg text-[#0b1c30] truncate">
                {user?.firstName || ''} {user?.lastName || ''}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => updateAvailability.mutate(!isAvailable)}
              disabled={updateAvailability.isPending}
              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full cursor-pointer transition-all ${
                isAvailable
                  ? 'bg-emerald-100 text-[#004322] hover:bg-emerald-200'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isAvailable ? 'bg-emerald-600' : 'bg-amber-600'
                }`}
              />
              <span>{isAvailable ? 'Transporteur Actif' : 'En pause'}</span>
            </button>

            <div className="flex items-center gap-3 text-xs text-gray-500 pt-0.5">
              <div className="flex items-center gap-1 font-bold text-amber-500">
                <Icon name="star" className="text-xs" />
                <span className="text-gray-900">
                  {profile?.averageRating ? Number(profile.averageRating).toFixed(1) : '-'}
                </span>
                <span className="text-gray-400 font-normal">({totalDeliveries})</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1 text-[11px] text-gray-400">
                <Icon name="verified_user" className="text-xs" />
                <span>Chauffeur vérifié</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Metric Badges */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs">
            <p className="text-xl font-black text-[#0b1c30]">
              {totalDeliveries}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
              Livraisons
            </p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs">
            <p className="text-xl font-black text-[#0b1c30]">
              {totalDistanceKm > 1000 ? `${(totalDistanceKm / 1000).toFixed(1)}k` : Math.round(totalDistanceKm)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
              Km Parcourus
            </p>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs">
            <p className="text-xl font-black text-emerald-600">{successRate}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
              Réussite
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
              activeTab === 'info' ? 'text-[#004322]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Informations
            {activeTab === 'info' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#004322] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
              activeTab === 'documents' ? 'text-[#004322]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Documents
            {activeTab === 'documents' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#004322] rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-2.5 text-center text-xs font-bold transition-all relative ${
              activeTab === 'reviews' ? 'text-[#004322]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Avis reçus
            {activeTab === 'reviews' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#004322] rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Informations */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Infos personnelles */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between text-[#0b1c30]">
                <div className="flex items-center gap-2">
                  <Icon name="person" className="text-lg text-[#004322]" />
                  <h3 className="font-extrabold text-sm">Infos personnelles</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-[#004322] font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Icon name="edit" className="text-xs" />
                  <span>Modifier</span>
                </button>
              </div>

              <div className="space-y-3 text-xs divide-y divide-gray-100">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-gray-500 font-medium">Nom complet</span>
                  <span className="font-bold text-[#0b1c30]">
                    {user?.firstName} {user?.lastName}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-gray-500 font-medium">Téléphone</span>
                  <span className="font-bold text-[#0b1c30]">
                    {user?.phoneNumber || 'Non renseigné'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-gray-500 font-medium">Email</span>
                  <span className="font-bold text-[#0b1c30]">
                    {user?.email}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="text-gray-500 font-medium">Pays / Région</span>
                  <span className="font-bold text-[#0b1c30]">
                    {user?.country || 'RDC'}
                  </span>
                </div>
              </div>
            </div>

            {/* Véhicule Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden space-y-3">
              <div className="p-4 pb-0 flex items-center justify-between text-[#0b1c30]">
                <div className="flex items-center gap-2">
                  <Icon name="local_shipping" className="text-lg text-[#004322]" />
                  <h3 className="font-extrabold text-sm">Véhicule</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-[#004322] font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Icon name="edit" className="text-xs" />
                  <span>Modifier</span>
                </button>
              </div>

              {vehicle ? (
                <div className="p-4 pt-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-[#0b1c30]">
                      {vehicle.brand || 'Véhicule de transport'}
                    </h4>
                    <span className="bg-sky-50 text-sky-800 font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border border-sky-200">
                      {vehicle.registrationPlate}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Icon name="inventory_2" className="text-sm text-gray-400" />
                      <span>{vehicle.capacityKg} kg max</span>
                    </div>
                    {vehicle.capacityM3 && (
                      <div className="flex items-center gap-1.5">
                        <Icon name="straighten" className="text-sm text-gray-400" />
                        <span>{vehicle.capacityM3} m³</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Icon name="verified" className="text-sm text-emerald-600" />
                      <span>Actif</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center space-y-2">
                  <p className="text-xs text-gray-500">Aucun véhicule assigné actuellement.</p>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-xs font-bold text-[#004322] hover:underline cursor-pointer"
                  >
                    + Renseigner mon véhicule
                  </button>
                </div>
              )}
            </div>

            {/* Disponibilités */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-[#0b1c30]">
                <Icon name="schedule" className="text-lg text-[#004322]" />
                <h3 className="font-extrabold text-sm">Disponibilités</h3>
              </div>

              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1.5">
                  {daysOfWeek.map((day, idx) => {
                    const isDayActive = selectedDays.includes(day.key);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                          isDayActive
                            ? 'bg-[#004322] text-white shadow-2xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs font-bold text-gray-700">07:00 — 19:00</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => {
                clearAuth();
                void navigate({ to: '/auth/login' });
              }}
              className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Icon name="logout" className="text-sm" />
              <span>Se déconnecter</span>
            </button>
          </div>
        )}

        {/* Tab 2: Documents */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0b1c30]">Pièces justificatives & Permis</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="text-xs text-[#004322] font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Icon name="edit" className="text-xs" />
                <span>Modifier</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <Icon name="badge" className="text-xl" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#0b1c30]">
                      Permis de Conduire ({profile?.licenseCategory || 'Catégorie B'})
                    </h4>
                    <p className="text-[11px] font-mono text-gray-500">
                      N° {profile?.licenseNumber || 'Non renseigné'}
                    </p>
                    {profile?.licenseExpiresAt && (
                      <p className="text-[10px] text-gray-400">
                        Expire le : {new Date(profile.licenseExpiresAt).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {profile?.licenseNumber ? 'Enregistré' : 'À renseigner'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Reviews */}
        {activeTab === 'reviews' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-[#0b1c30]">Avis reçus</h3>
              <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                <Icon name="star" className="text-sm" />
                <span>{profile?.averageRating ? `${Number(profile.averageRating).toFixed(1)} / 5.0` : '-'}</span>
              </div>
            </div>

            <div className="py-8 text-center text-gray-500 space-y-2">
              <Icon name="rate_review" className="text-3xl text-gray-400 mx-auto block" />
              <p className="text-xs font-semibold">Aucun avis reçu pour le moment.</p>
              <p className="text-[11px] text-gray-400">
                Les évaluations des expéditeurs et des clients apparaîtront ici après vos livraisons.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Driver Profile Edit Modal */}
      {isEditModalOpen && (
        <EditDriverProfileModal
          user={user}
          profile={profile}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
}

interface EditDriverProfileModalProps {
  user: any;
  profile: any;
  onClose: () => void;
}

function EditDriverProfileModal({ user, profile, onClose }: EditDriverProfileModalProps) {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber || '');
  const [licenseCategory, setLicenseCategory] = useState(profile?.licenseCategory || 'B');
  const [licenseExpiresAt, setLicenseExpiresAt] = useState(
    profile?.licenseExpiresAt ? profile.licenseExpiresAt.slice(0, 10) : '',
  );
  const [vehicleBrand, setVehicleBrand] = useState(profile?.vehicle?.brand || '');
  const [vehiclePlate, setVehiclePlate] = useState(profile?.vehicle?.registrationPlate || '');

  const updateProfile = useMutation({
    ...updateMyDriverProfileMutation(),
    onSuccess: (updatedUser) => {
      addToast('Profil mis à jour avec succès', 'success');
      if (updatedUser) {
        updateAuthUser({
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phoneNumber: updatedUser.phoneNumber,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['driver', 'profile', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['driver', 'my-runs'] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la mise à jour';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    updateProfile.mutate({
      userId: user.id,
      firstName,
      lastName,
      phoneNumber,
      licenseNumber,
      licenseCategory,
      licenseExpiresAt: licenseExpiresAt || undefined,
      vehicleBrand,
      vehiclePlate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-lg font-black text-[#0b1c30]">Modifier mon profil</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Identité */}
          <div className="space-y-2">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Identité & Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Prénom</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Nom</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1">Téléphone</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+243..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none"
              />
            </div>
          </div>

          {/* Permis de conduire */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Permis de conduire</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Numéro de permis</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Ex: DL-98234-A"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Catégorie</label>
                <select
                  value={licenseCategory}
                  onChange={(e) => setLicenseCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none bg-white"
                >
                  <option value="B">B (Voiture / Utilitaire léger)</option>
                  <option value="C">C (Poids lourd)</option>
                  <option value="CE">CE (Poids lourd avec remorque)</option>
                  <option value="D">D (Transport en commun)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1">Date d'expiration du permis</label>
              <input
                type="date"
                value={licenseExpiresAt}
                onChange={(e) => setLicenseExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none"
              />
            </div>
          </div>

          {/* Véhicule */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Véhicule assigné</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Marque / Modèle</label>
                <input
                  type="text"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Ex: Renault Master Frigo"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-600 font-semibold mb-1">Plaque d'immatriculation</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Ex: AB-123-CD"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:border-[#004322] focus:ring-1 focus:ring-[#004322] outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="px-5 py-2.5 rounded-xl bg-[#004322] hover:bg-[#00331a] text-white font-bold cursor-pointer disabled:opacity-50 transition-colors"
            >
              {updateProfile.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
