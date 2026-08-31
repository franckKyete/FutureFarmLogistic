import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission } from '@futurefarm/types';
import {
  useCreateInspector,
  useCreateDriver,
} from '@/features/admin/api/users.queries';
import { AdminCard, Button } from '@/features/admin/components';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/admin/users/new')({
  beforeLoad: () => {
    requireAuth(Permission.USER_CREATE);
  },
  component: CreateFieldAgentPage,
});

type AgentRole = 'inspector' | 'driver';

const SPECIALIZATION_OPTIONS = [
  'Céréales & Grains',
  'Fruits & Légumes',
  'Cacao & Café',
  'Tubercules (Manioc, Igname)',
  'Oléagineux & Noix',
  'Produits Vivriers Frais',
];

const LICENSE_CATEGORIES = [
  { value: 'B', label: 'Permis B', desc: 'Véhicules légers & camionnettes (< 3.5t)' },
  { value: 'C', label: 'Permis C', desc: 'Poids lourds & camions de collecte (> 3.5t)' },
  { value: 'D', label: 'Permis D', desc: 'Transport collectif & navettes agricoles' },
  { value: 'E', label: 'Permis E', desc: 'Véhicules articulés & remorques lourdes' },
];

function CreateFieldAgentPage() {
  const navigate = useNavigate();
  const createInspectorMutation = useCreateInspector();
  const createDriverMutation = useCreateDriver();

  const [agentRole, setAgentRole] = useState<AgentRole>('inspector');

  // Common identity fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Inspector specific fields
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([
    'Céréales & Grains',
    'Fruits & Légumes',
  ]);

  // Driver specific fields
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [licenseCategory, setLicenseCategory] = useState('B');
  const [licenseExpiresAt, setLicenseExpiresAt] = useState('');

  // Success result modal
  const [createdAgentResult, setCreatedAgentResult] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  const toggleSpecialization = (spec: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim()) {
      addToast('Le numéro de téléphone est obligatoire', 'error');
      return;
    }

    if (agentRole === 'inspector') {
      const payload = {
        firstName,
        lastName,
        email,
        phoneNumber: phone.trim(),
        specializations: selectedSpecializations,
      };

      createInspectorMutation.mutate(payload, {
        onSuccess: () => {
          addToast("Inspecteur créé ! Un email d'activation avec son mot de passe lui a été envoyé.", 'success');
          setCreatedAgentResult({
            name: `${firstName} ${lastName}`,
            email,
            role: 'Inspecteur Qualité Certifié',
          });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || "Erreur lors de la création de l'inspecteur";
          addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        },
      });
    } else {
      if (!driverLicenseNumber.trim()) {
        addToast('Veuillez renseigner le numéro de permis du chauffeur', 'error');
        return;
      }

      const payload: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        licenseNumber: string;
        licenseCategory: string;
        licenseExpiresAt?: string;
      } = {
        firstName,
        lastName,
        email,
        phoneNumber: phone.trim(),
        licenseNumber: driverLicenseNumber.trim(),
        licenseCategory,
      };
      if (licenseExpiresAt) payload.licenseExpiresAt = licenseExpiresAt;

      createDriverMutation.mutate(payload, {
        onSuccess: () => {
          addToast("Chauffeur enregistré ! Un email d'activation avec son mot de passe lui a été envoyé.", 'success');
          setCreatedAgentResult({
            name: `${firstName} ${lastName}`,
            email,
            role: `Chauffeur Transporteur (Permis ${licenseCategory})`,
          });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || 'Erreur lors de la création du chauffeur';
          addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
        },
      });
    }
  };

  const handleResetForm = () => {
    setCreatedAgentResult(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setDriverLicenseNumber('');
    setLicenseExpiresAt('');
  };

  const isPending = createInspectorMutation.isPending || createDriverMutation.isPending;

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)] mb-2">
          <Link to="/admin/users" className="hover:text-[var(--admin-primary)] flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Gestion des utilisateurs
          </Link>
          <span>/</span>
          <span className="text-[var(--admin-primary)]">Nouvel agent terrain</span>
        </div>

        <h1 className="text-3xl font-semibold text-[var(--admin-primary)] tracking-tight mb-1">
          Création d'un Collaborateur Terrain
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)] font-medium">
          Délivrez des accès certifiés pour les auditeurs de qualité et les transporteurs logistiques du réseau Future Farm.
        </p>
      </div>

      {/* Role Selector Segmented Hero */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => setAgentRole('inspector')}
          className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
            agentRole === 'inspector'
              ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-container)]/10 shadow-sm ring-2 ring-[var(--admin-primary)]/20'
              : 'border-[var(--admin-outline-variant)]/40 bg-white hover:border-[var(--admin-outline-variant)]'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
              agentRole === 'inspector'
                ? 'bg-[var(--admin-primary)] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className="material-symbols-outlined">verified</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--admin-on-surface)]">Inspecteur Qualité</h3>
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  agentRole === 'inspector'
                    ? 'border-[var(--admin-primary)] bg-[var(--admin-primary)]'
                    : 'border-gray-300'
                }`}
              >
                {agentRole === 'inspector' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
            </div>
            <p className="text-xs text-[var(--admin-on-surface-variant)] mt-1 leading-relaxed">
              Effectue les audits sur parcelles, valide la conformité sanitaire, réalise le pré-screening IA et certifie les récoltes.
            </p>
          </div>
        </div>

        <div
          onClick={() => setAgentRole('driver')}
          className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
            agentRole === 'driver'
              ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-container)]/10 shadow-sm ring-2 ring-[var(--admin-primary)]/20'
              : 'border-[var(--admin-outline-variant)]/40 bg-white hover:border-[var(--admin-outline-variant)]'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
              agentRole === 'driver'
                ? 'bg-[var(--admin-primary)] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className="material-symbols-outlined">local_shipping</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[var(--admin-on-surface)]">Chauffeur / Transporteur</h3>
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  agentRole === 'driver'
                    ? 'border-[var(--admin-primary)] bg-[var(--admin-primary)]'
                    : 'border-gray-300'
                }`}
              >
                {agentRole === 'driver' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
            </div>
            <p className="text-xs text-[var(--admin-on-surface-variant)] mt-1 leading-relaxed">
              Prend en charge les tournées de collecte et de livraison, transmet les coordonnées GPS et valide les étapes de transport.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Input Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Contact Card */}
          <AdminCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[var(--admin-outline-variant)]/20 pb-3">
              <span className="material-symbols-outlined text-[var(--admin-primary)]">badge</span>
              <h2 className="font-bold text-base text-[var(--admin-on-surface)]">
                1. Identité & Coordonnées de Contact
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Prénom <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: Amadou"
                  className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[var(--admin-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Nom de famille <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex: Diallo"
                  className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[var(--admin-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Adresse Email professionnelle <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amadou.diallo@futurefarm.ci"
                  className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[var(--admin-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Numéro de Téléphone portable <span className="text-rose-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 48 92 11 00"
                  className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[var(--admin-primary)] focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-[#eff4ff] p-3.5 rounded-xl border border-blue-100 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-blue-600 text-lg shrink-0 mt-0.5">mail</span>
              <p className="text-xs text-blue-900 leading-relaxed">
                Le mot de passe initial sera <strong>généré automatiquement de manière sécurisée</strong> par le serveur et <strong>envoyé directement par email</strong> à l'adresse renseignée dès la validation.
              </p>
            </div>
          </AdminCard>

          {/* Professional Credentials Card (Dynamic per role) */}
          <AdminCard className="p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[var(--admin-outline-variant)]/20 pb-3">
              <span className="material-symbols-outlined text-[var(--admin-primary)]">
                {agentRole === 'inspector' ? 'workspace_premium' : 'commute'}
              </span>
              <h2 className="font-bold text-base text-[var(--admin-on-surface)]">
                {agentRole === 'inspector'
                  ? '2. Domaines d’Expertise Agricole'
                  : '2. Permis de Conduire & Affectation Logistique'}
              </h2>
            </div>

            {agentRole === 'inspector' ? (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Sélectionnez les filières et catégories de produits auditées
                </label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATION_OPTIONS.map((spec) => {
                    const isSelected = selectedSpecializations.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleSpecialization(spec)}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--admin-primary)] text-white shadow-xs'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isSelected ? 'check' : 'add'}
                        </span>
                        {spec}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Numéro de permis de conduire <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={driverLicenseNumber}
                      onChange={(e) => setDriverLicenseNumber(e.target.value.toUpperCase())}
                      placeholder="DRV-CI-84920"
                      className="w-full text-sm font-mono font-bold border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[var(--admin-primary)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Date d'expiration du permis
                    </label>
                    <input
                      type="date"
                      value={licenseExpiresAt}
                      onChange={(e) => setLicenseExpiresAt(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[var(--admin-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Catégorie de permis validée
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {LICENSE_CATEGORIES.map((cat) => {
                      const isSelected = licenseCategory === cat.value;
                      return (
                        <div
                          key={cat.value}
                          onClick={() => setLicenseCategory(cat.value)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[var(--admin-primary)] bg-[var(--admin-primary-container)]/10 ring-1 ring-[var(--admin-primary)]'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[var(--admin-on-surface)]">{cat.label}</span>
                            {isSelected && (
                              <span className="material-symbols-outlined text-sm text-[var(--admin-primary)] font-bold">
                                check_circle
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{cat.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </AdminCard>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/admin/users"
              className="px-6 py-3 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Annuler
            </Link>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              className="px-8 py-3 bg-[var(--admin-primary)] hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              {isPending ? 'Création en cours...' : 'Créer et Envoyer les Accès par Email'}
            </Button>
          </div>
        </div>

        {/* Right 1 Column: Live Digital Agent Badge Card */}
        <div className="space-y-6">
          <AdminCard className="p-6 space-y-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-[var(--admin-outline-variant)]/20 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Aperçu du Badge Numérique</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Stylized Badge Visual */}
            <div className="bg-gradient-to-br from-[#004322] to-[#1a5c35] text-white p-5 rounded-2xl shadow-lg relative overflow-hidden space-y-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-10 translate-x-10 pointer-events-none" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-200">Future Farm Logistic</p>
                  <p className="text-xs font-extrabold text-white">OFFICIAL ACCREDITATION</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg text-white">
                    {agentRole === 'inspector' ? 'verified_user' : 'local_shipping'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-bold text-xl text-white shadow-inner">
                  {firstName ? firstName.charAt(0).toUpperCase() : 'A'}
                  {lastName ? lastName.charAt(0).toUpperCase() : 'T'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-base text-white truncate">
                    {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Nom du Collaborateur'}
                  </h4>
                  <span className="inline-block mt-0.5 px-2 py-0.5 bg-emerald-800 text-emerald-100 text-[10px] font-bold rounded-full">
                    {agentRole === 'inspector' ? 'Inspecteur Qualité' : `Chauffeur Permis ${licenseCategory}`}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/15 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-[9px] text-emerald-300 font-semibold uppercase">Téléphone</p>
                  <p className="font-mono font-bold text-white truncate">
                    {phone || '+225 ...'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-300 font-semibold uppercase">
                    {agentRole === 'inspector' ? 'Expertise' : 'Permis'}
                  </p>
                  <p className="font-medium text-white truncate">
                    {agentRole === 'inspector'
                      ? `${selectedSpecializations.length} filière(s)`
                      : `Cat. ${licenseCategory}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#eff4ff] p-3.5 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-blue-600">mark_email_read</span>
                Envoi automatique
              </p>
              <p className="text-[11px] leading-relaxed text-blue-800">
                Dès validation, les identifiants et instructions de première connexion seront envoyés au collaborateur par email.
              </p>
            </div>
          </AdminCard>
        </div>
      </form>

      {/* Success Modal */}
      {createdAgentResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-slide-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#004322] flex items-center justify-center mx-auto shadow-xs">
              <span className="material-symbols-outlined text-3xl">mark_email_read</span>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-xl text-gray-900">Utilisateur créé avec succès</h3>
              <p className="text-xs text-gray-500">
                Le compte de <strong className="text-gray-800">{createdAgentResult.name}</strong> a été créé et l'email avec les identifiants est en cours d'envoi.
              </p>
            </div>

            <div className="bg-[#f8f9ff] rounded-2xl p-4 border border-gray-200 space-y-3">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Email de connexion</p>
                <p className="text-sm font-semibold font-mono text-[#0b1c30]">{createdAgentResult.email}</p>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Rôle attribué</p>
                <p className="text-sm font-semibold text-gray-800">{createdAgentResult.role}</p>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mb-1">
                  <span className="material-symbols-outlined text-sm">mark_email_read</span>
                  Notification envoyée
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Un email contenant les instructions et les identifiants de connexion a été envoyé au collaborateur.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Inscrire un autre agent
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: '/admin/users' })}
                className="py-3 bg-[#004322] hover:bg-[#00331a] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Voir les utilisateurs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
