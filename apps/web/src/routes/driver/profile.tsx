import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyDriverProfileQuery, updateDriverAvailabilityMutation } from '@/features/tracking/api/tracking.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { clearAuth } from '@/features/auth/store/auth.store';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/driver/profile')({
  component: DriverProfilePage,
});

function DriverProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(getMyDriverProfileQuery());

  const updateAvailability = useMutation({
    ...updateDriverAvailabilityMutation(),
    onSuccess: (data) => {
      addToast(
        data?.isAvailable ? 'Vous êtes maintenant disponible' : 'Statut mis à jour : en pause',
        'success'
      );
      queryClient.invalidateQueries({ queryKey: ['driver', 'profile', 'me'] });
    },
    onError: () => addToast('Erreur lors de la mise à jour du statut', 'error'),
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#004322]">Espace Chauffeur</span>
        <h1 className="text-xl font-bold text-[#0b1c30]">Profil & Statut</h1>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4 flex-1">
        {/* User Card */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#004322] text-white flex items-center justify-center font-bold text-xl shadow-xs">
            {user?.firstName?.charAt(0) || 'C'}
            {user?.lastName?.charAt(0) || ''}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#0b1c30] truncate">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <span className="inline-block mt-1 bg-emerald-100 text-[#004322] text-[10px] font-bold px-2 py-0.5 rounded-full">
              Chauffeur certifié
            </span>
          </div>
        </div>

        {/* Availability Switch */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Disponibilité opérationnelle</h3>
              <p className="text-xs text-gray-500">
                Activez pour recevoir des affectations de tournées
              </p>
            </div>

            <button
              onClick={() => {
                const currentStatus = profile?.isAvailable ?? true;
                updateAvailability.mutate(!currentStatus);
              }}
              disabled={updateAvailability.isPending || isLoading}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                (profile?.isAvailable ?? true) ? 'bg-[#004322]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  (profile?.isAvailable ?? true) ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl text-xs flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                (profile?.isAvailable ?? true) ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold text-gray-700">
              Statut actuel : {(profile?.isAvailable ?? true) ? 'Prêt pour mission' : 'En pause / Hors service'}
            </span>
          </div>
        </div>

        {/* License Details */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Permis de conduire
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f8f9ff] p-3 rounded-xl">
              <p className="text-[10px] text-gray-500 font-semibold">Numéro de permis</p>
              <p className="text-sm font-bold font-mono text-[#0b1c30]">
                {profile?.licenseNumber || 'CI-2024-8891'}
              </p>
            </div>
            <div className="bg-[#f8f9ff] p-3 rounded-xl">
              <p className="text-[10px] text-gray-500 font-semibold">Catégorie</p>
              <p className="text-sm font-bold font-mono text-[#0b1c30]">
                Catégorie {profile?.licenseCategory || 'B / C'}
              </p>
            </div>
            <div className="bg-[#f8f9ff] p-3 rounded-xl col-span-2">
              <p className="text-[10px] text-gray-500 font-semibold">Date d'expiration</p>
              <p className="text-sm font-bold text-[#0b1c30]">
                {profile?.licenseExpiresAt
                  ? new Date(profile.licenseExpiresAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'Valide (Permanent)'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 space-y-2">
          <button
            onClick={() => {
              clearAuth();
              void navigate({ to: '/auth/login' });
            }}
            className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Déconnexion
          </button>
        </div>
      </main>
    </div>
  );
}
