import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { BuyerBusinessType } from '@futurefarm/types';
import { registerFarmerMutation, registerBuyerMutation, loginMutation } from '@/features/auth/api/auth.queries';
import { setAuth } from '@/features/auth/store/auth.store';
import type { RegisterFarmerPayload, RegisterBuyerPayload } from '@/features/auth/api/auth.queries';

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'FARMER' | 'BUYER'>('FARMER');
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);

  // Form Field States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [accountType, setAccountType] = useState('individual'); // individual | cooperative
  const [businessType, setBusinessType] = useState<BuyerBusinessType>(BuyerBusinessType.RESTAURATEUR);

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState(''); // Address (Farmer) or Billing Address (Buyer)
  const [shippingAddress, setShippingAddress] = useState(''); // Only Buyer

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vatNumber, setVatNumber] = useState(''); // Only Buyer
  const [bio, setBio] = useState(''); // Only Farmer

  const [validationError, setValidationError] = useState('');

  // Auto-login Mutation
  const { mutate: login, isPending: loginPending, error: loginError } = useMutation({
    ...loginMutation(),
    onSuccess: (data) => {
      setAuth(data.user, data.tokens);
      setSuccess(true);
      setTimeout(() => {
        void navigate({ to: '/' });
      }, 1500);
    },
  });

  const { mutate: registerFarmer, isPending: farmerPending, error: farmerError } = useMutation({
    ...registerFarmerMutation(),
    onSuccess: () => {
      // Auto login immediately
      login({ email, password });
    },
  });

  const { mutate: registerBuyer, isPending: buyerPending, error: buyerError } = useMutation({
    ...registerBuyerMutation(),
    onSuccess: () => {
      // Auto login immediately
      login({ email, password });
    },
  });

  const isPending = farmerPending || buyerPending || loginPending;
  const serverError = role === 'FARMER' ? (farmerError || loginError) : (buyerError || loginError);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (step === 1) {
      if (!firstName || !lastName || !companyName) {
        setValidationError('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!email || !address) {
        setValidationError('L\'adresse email et l\'adresse physique sont requises.');
        return;
      }
      if (role === 'BUYER' && !shippingAddress) {
        setValidationError('L\'adresse de livraison est requise.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!password || password.length < 8) {
      setValidationError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (role === 'BUYER' && !vatNumber) {
      setValidationError('Le numéro de TVA / Enregistrement est requis.');
      return;
    }

    // Prepare Payload
    const baseData = {
      email,
      password,
      firstName,
      lastName,
      companyName,
    };

    if (phoneNumber) {
      Object.assign(baseData, { phoneNumber });
    }

    if (role === 'FARMER') {
      const payload: RegisterFarmerPayload = {
        ...baseData,
        address,
      };
      if (bio) payload.bio = bio;
      registerFarmer(payload);
    } else {
      const payload: RegisterBuyerPayload = {
        ...baseData,
        vatNumber,
        businessType,
        billingAddress: address,
        shippingAddress,
      };
      registerBuyer(payload);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative px-4 py-12 bg-[#F7F8F5]">
      {/* Background grid */}
      <div className="fixed inset-0 z-[-1] opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(#707970 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        ></div>
      </div>

      <main className="w-full max-w-[520px] bg-white border border-[#c0c9be]/50 rounded-2xl p-8 flex flex-col gap-6 shadow-sm">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">grain</span>
            <span className="font-display text-xl font-bold text-primary tracking-tight">Future Farm</span>
          </div>
          <Link className="text-xs font-semibold text-primary hover:underline" to="/auth/login">
            Déjà un compte ? Se connecter
          </Link>
        </header>

        {/* Stepper progress indicator */}
        <nav className="relative flex justify-between items-center px-4 my-2">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#c0c9be]/50 -translate-y-1/2 z-0"></div>
          {/* Step 1 */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 1 ? 'bg-primary text-white' : 'bg-white border border-[#c0c9be]/50 text-[#707970]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
            <span className={`text-[10px] font-semibold ${step >= 1 ? 'text-on-surface' : 'text-[#707970]'}`}>
              Identité
            </span>
          </div>
          {/* Step 2 */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 2 ? 'bg-primary text-white' : 'bg-white border border-[#c0c9be]/50 text-[#707970]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">phone</span>
            </div>
            <span className={`text-[10px] font-semibold ${step >= 2 ? 'text-on-surface' : 'text-[#707970]'}`}>
              Contact
            </span>
          </div>
          {/* Step 3 */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 3 ? 'bg-primary text-white' : 'bg-white border border-[#c0c9be]/50 text-[#707970]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
            </div>
            <span className={`text-[10px] font-semibold ${step >= 3 ? 'text-on-surface' : 'text-[#707970]'}`}>
              Sécurité
            </span>
          </div>
        </nav>

        {success ? (
          <div className="bg-[#dde6d1] border border-primary/20 rounded-xl p-8 text-center flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
            <h3 className="font-semibold text-primary text-lg">Connexion en cours...</h3>
            <p className="text-xs text-on-tertiary-fixed-variant leading-relaxed">
              Votre compte a été créé. Vous allez être redirigé vers votre tableau de bord...
            </p>
          </div>
        ) : (
          <div>
            {/* Step 1 Form */}
            {step === 1 && (
              <form onSubmit={handleNext} className="flex flex-col gap-4">
                {/* Role select input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface">Type de compte</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('FARMER')}
                      className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                        role === 'FARMER' ? 'border-primary bg-primary/5' : 'border-[#c0c9be]/50 hover:border-primary/50'
                      }`}
                    >
                      <span className="text-xs font-bold text-on-surface">Producteur</span>
                      <span className="text-[10px] text-on-surface-variant mt-0.5">Exploitation personnelle / Coopérative</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('BUYER')}
                      className={`p-3 border rounded-xl flex flex-col text-left transition-all ${
                        role === 'BUYER' ? 'border-primary bg-primary/5' : 'border-[#c0c9be]/50 hover:border-primary/50'
                      }`}
                    >
                      <span className="text-xs font-bold text-on-surface">Acheteur</span>
                      <span className="text-[10px] text-on-surface-variant mt-0.5">Restaurateur, Grossiste ou Industriel</span>
                    </button>
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="firstName">
                      Prénom
                    </label>
                    <input
                      className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      type="text"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="lastName">
                      Nom
                    </label>
                    <input
                      className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      type="text"
                      required
                    />
                  </div>
                </div>

                {/* Company Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="companyName">
                    {role === 'FARMER' ? 'Nom de l\'exploitation' : 'Nom de l\'entreprise'}
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    type="text"
                    required
                  />
                </div>

                {/* Account details subtype selection */}
                {role === 'FARMER' ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant">Type d'exploitation</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 p-3 border border-[#c0c9be]/50 rounded-xl cursor-pointer hover:border-primary transition-all">
                        <input
                          type="radio"
                          name="accountType"
                          checked={accountType === 'individual'}
                          onChange={() => setAccountType('individual')}
                          className="accent-primary"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-on-surface">Individuel</span>
                          <span className="text-[9px] text-[#707970]">Exploitation propre</span>
                        </div>
                      </label>
                      <label className="flex items-center gap-2 p-3 border border-[#c0c9be]/50 rounded-xl cursor-pointer hover:border-primary transition-all">
                        <input
                          type="radio"
                          name="accountType"
                          checked={accountType === 'cooperative'}
                          onChange={() => setAccountType('cooperative')}
                          className="accent-primary"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-on-surface">Coopérative</span>
                          <span className="text-[9px] text-[#707970]">Regroupement</span>
                        </div>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="businessType">
                      Type d'activité
                    </label>
                    <select
                      className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      id="businessType"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value as BuyerBusinessType)}
                      required
                    >
                      <option value={BuyerBusinessType.RESTAURATEUR}>Restaurateur</option>
                      <option value={BuyerBusinessType.GROSSISTE}>Grossiste</option>
                      <option value={BuyerBusinessType.INDUSTRIEL}>Industriel</option>
                    </select>
                  </div>
                )}

                {validationError && <p className="text-xs text-error font-medium">{validationError}</p>}

                <button
                  type="submit"
                  className="w-full h-12 bg-primary text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer mt-2"
                >
                  Suivant
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </form>
            )}

            {/* Step 2 Form */}
            {step === 2 && (
              <form onSubmit={handleNext} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="email">
                    Adresse Email
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-outline/40"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="exemple@futurefarm.com"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="phoneNumber">
                    Numéro de téléphone
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    type="tel"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="address">
                    {role === 'FARMER' ? 'Adresse de l\'exploitation' : 'Adresse de facturation'}
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    type="text"
                    required
                  />
                </div>

                {role === 'BUYER' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="shippingAddress">
                      Adresse de livraison
                    </label>
                    <input
                      className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      id="shippingAddress"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      type="text"
                      required
                    />
                  </div>
                )}

                {validationError && <p className="text-xs text-error font-medium">{validationError}</p>}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 h-12 bg-white border border-[#c0c9be]/60 text-[#707970] font-semibold text-sm rounded-lg flex items-center justify-center hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 h-12 bg-primary text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Suivant
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 3 Form */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="password">
                    Mot de passe
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="Min. 8 caractères"
                    minLength={8}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="confirmPassword">
                    Confirmer le mot de passe
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    required
                  />
                </div>

                {role === 'BUYER' ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="vatNumber">
                      Numéro de TVA / Enregistrement fiscal
                    </label>
                    <input
                      className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                      id="vatNumber"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      type="text"
                      required
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="bio">
                      Présentation de l'exploitation (Optionnel)
                    </label>
                    <textarea
                      className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all min-h-[80px]"
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Indiquez vos cultures, modes de production, certifications..."
                    />
                  </div>
                )}

                {validationError && <p className="text-xs text-error font-medium">{validationError}</p>}
                {serverError && (
                  <p className="text-xs text-error font-medium">
                    {serverError instanceof Error ? serverError.message : 'Erreur d\'inscription.'}
                  </p>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-1/3 h-12 bg-white border border-[#c0c9be]/60 text-[#707970] font-semibold text-sm rounded-lg flex items-center justify-center hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-2/3 h-12 bg-primary text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Création...' : 'S\'inscrire'}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer info */}
        <footer className="mt-4 flex flex-col items-center gap-2">
          <p className="text-[10px] text-[#707970] text-center leading-relaxed">
            V2.0 — Optimisé pour le secteur agricole.<br />
            Propulsé par l'écosystème Future Farm.
          </p>
        </footer>
      </main>
    </div>
  );
}
