import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { BuyerBusinessType } from '@futurefarm/types';
import { registerFarmerMutation, registerBuyerMutation, loginMutation } from '@/features/auth/api/auth.queries';
import { useActiveRegions } from '@/features/admin/api/inspections.queries';
import { setAuth } from '@/features/auth/store/auth.store';
import { useCurrencyStore } from '@/features/currency/store/currency.store';
import { AddressInputGroup, type AddressValue } from '@/features/addresses/components';
import type { RegisterFarmerPayload, RegisterBuyerPayload } from '@/features/auth/api/auth.queries';

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
});

function formatAddressString(addr: AddressValue): string {
  return [
    addr.streetAddress,
    addr.streetAddress2,
    addr.city,
    addr.stateOrProvince,
    addr.country,
  ]
    .filter(Boolean)
    .join(', ');
}

function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'FARMER' | 'BUYER'>('FARMER');
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);

  // Active regions query for farmers
  const { data: activeRegions = [], isLoading: regionsLoading } = useActiveRegions();

  // Form Field States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [accountType, setAccountType] = useState('individual'); // individual | cooperative
  const [businessType, setBusinessType] = useState<BuyerBusinessType>(BuyerBusinessType.RESTAURATEUR);

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Structured Multi-Field Addresses
  const [farmerAddress, setFarmerAddress] = useState<AddressValue>({
    streetAddress: '',
    streetAddress2: '',
    city: '',
    stateOrProvince: '',
    country: 'COD',
  });
  const [regionName, setRegionName] = useState(''); // Only Farmer

  const [buyerBillingAddress, setBuyerBillingAddress] = useState<AddressValue>({
    streetAddress: '',
    streetAddress2: '',
    city: '',
    stateOrProvince: '',
    country: 'COD',
  });

  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [buyerShippingAddress, setBuyerShippingAddress] = useState<AddressValue>({
    streetAddress: '',
    streetAddress2: '',
    city: '',
    stateOrProvince: '',
    country: 'COD',
  });

  const countries = useCurrencyStore((s) => s.countries);
  const [buyerPreferredCurrency, setBuyerPreferredCurrency] = useState('CDF');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bio, setBio] = useState(''); // Only Farmer

  const [validationError, setValidationError] = useState('');

  // Auto-login Mutation
  const { mutate: login, isPending: loginPending, error: loginError } = useMutation({
    ...loginMutation(),
    onSuccess: (data) => {
      if (!data.require2fa) {
        setAuth(data.user, data.tokens);
      }
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
      if (!firstName.trim() || !lastName.trim()) {
        setValidationError('Veuillez renseigner votre prénom et nom.');
        return;
      }
      if (role === 'FARMER' && !companyName.trim()) {
        setValidationError('Le nom de l\'exploitation est obligatoire pour les producteurs.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!email.trim()) {
        setValidationError('L\'adresse email est obligatoire.');
        return;
      }
      if (role === 'FARMER') {
        if (!phoneNumber.trim()) {
          setValidationError('Le numéro de téléphone est obligatoire pour les producteurs.');
          return;
        }
        if (!regionName.trim()) {
          setValidationError('Veuillez sélectionner la région dans laquelle vous opérez.');
          return;
        }
        if (!farmerAddress.streetAddress || !farmerAddress.city || !farmerAddress.stateOrProvince) {
          setValidationError('Veuillez renseigner l\'adresse complète de votre exploitation (Ligne 1, Ville, Province/Région).');
          return;
        }
      } else {
        if (!buyerBillingAddress.streetAddress || !buyerBillingAddress.city || !buyerBillingAddress.stateOrProvince) {
          setValidationError('Veuillez renseigner l\'adresse de facturation complète (Ligne 1, Ville, Province/Région).');
          return;
        }
        if (!sameAsBilling && (!buyerShippingAddress.streetAddress || !buyerShippingAddress.city || !buyerShippingAddress.stateOrProvince)) {
          setValidationError('Veuillez renseigner l\'adresse de livraison complète.');
          return;
        }
      }
      setStep(3);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!password || password.length < 8) {
      setValidationError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas.');
      return;
    }

    // Prepare Payload
    const baseData = {
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    };

    if (phoneNumber.trim()) {
      Object.assign(baseData, { phoneNumber: phoneNumber.trim() });
    }

    if (role === 'FARMER') {
      const payload: RegisterFarmerPayload = {
        ...baseData,
        phoneNumber: phoneNumber.trim(),
        companyName: companyName.trim(),
        address: formatAddressString(farmerAddress),
        regionName,
      };
      if (bio.trim()) payload.bio = bio.trim();
      registerFarmer(payload);
    } else {
      const shippingAddrObj = sameAsBilling ? buyerBillingAddress : buyerShippingAddress;
      const buyerCountry = buyerBillingAddress.country || 'COD';
      const hasCompany = Boolean(companyName.trim());

      const payload: RegisterBuyerPayload = {
        ...baseData,
        country: buyerCountry,
        preferredCurrency: buyerPreferredCurrency,
        companyName: hasCompany ? companyName.trim() : undefined,
        businessType: hasCompany ? businessType : undefined,
        billingAddress: formatAddressString(buyerBillingAddress),
        shippingAddress: formatAddressString(shippingAddrObj),
      };
      registerBuyer(payload);
    }
  };

  const currentCountryCode = buyerBillingAddress.country || 'COD';
  const countryConfig = countries.find((c) => c.countryCode === currentCountryCode);

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
            <Icon name="grain" className="text-primary text-3xl" />
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
              <Icon name="person" className="text-[18px]" />
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
              <Icon name="phone" className="text-[18px]" />
            </div>
            <span className={`text-[10px] font-semibold ${step >= 2 ? 'text-on-surface' : 'text-[#707970]'}`}>
              Contact & Adresse
            </span>
          </div>
          {/* Step 3 */}
          <div className="relative z-10 flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 3 ? 'bg-primary text-white' : 'bg-white border border-[#c0c9be]/50 text-[#707970]'
              }`}
            >
              <Icon name="lock" className="text-[18px]" />
            </div>
            <span className={`text-[10px] font-semibold ${step >= 3 ? 'text-on-surface' : 'text-[#707970]'}`}>
              Sécurité
            </span>
          </div>
        </nav>

        {success ? (
          <div className="bg-[#dde6d1] border border-primary/20 rounded-xl p-8 text-center flex flex-col items-center gap-3">
            <Icon name="check_circle" className="text-primary text-5xl" />
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
                  <label className="text-xs font-bold text-on-surface">
                    Type de compte <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('FARMER')}
                      className={`p-3 border rounded-xl flex flex-col text-left transition-all cursor-pointer ${
                        role === 'FARMER' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-[#c0c9be]/50 hover:border-primary/50'
                      }`}
                    >
                      <span className="text-xs font-bold text-on-surface">Producteur</span>
                      <span className="text-[10px] text-on-surface-variant mt-0.5">Exploitation agricole / Coopérative</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('BUYER')}
                      className={`p-3 border rounded-xl flex flex-col text-left transition-all cursor-pointer ${
                        role === 'BUYER' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-[#c0c9be]/50 hover:border-primary/50'
                      }`}
                    >
                      <span className="text-xs font-bold text-on-surface">Acheteur</span>
                      <span className="text-[10px] text-on-surface-variant mt-0.5">Particulier ou Professionnel</span>
                    </button>
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="firstName">
                      Prénom <span className="text-red-500">*</span>
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
                      Nom <span className="text-red-500">*</span>
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
                    {role === 'FARMER' ? (
                      <>
                        Nom de l'exploitation <span className="text-red-500">*</span>
                      </>
                    ) : (
                      <>
                        Nom de l'entreprise <span className="text-gray-400 font-normal">(Optionnel)</span>
                      </>
                    )}
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    type="text"
                    placeholder={role === 'FARMER' ? 'Ex: Ferme Agro Kivu' : 'Ex: SARL Agro Import (optionnel)'}
                    required={role === 'FARMER'}
                  />
                </div>

                {/* Account details subtype selection */}
                {role === 'FARMER' ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant">
                      Type d'exploitation <span className="text-red-500">*</span>
                    </label>
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
                  companyName.trim().length > 0 && (
                    <div className="flex flex-col gap-1 animate-slide-in">
                      <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="businessType">
                        Type d'activité <span className="text-red-500">*</span>
                      </label>
                      <select
                        className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                        id="businessType"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value as BuyerBusinessType)}
                        required
                      >
                        <option value={BuyerBusinessType.RESTAURATEUR}>Restaurateur / Métiers de bouche</option>
                        <option value={BuyerBusinessType.GROSSISTE}>Grossiste / Distributeur</option>
                        <option value={BuyerBusinessType.INDUSTRIEL}>Industriel / Transformateur</option>
                      </select>
                    </div>
                  )
                )}

                {validationError && <p className="text-xs text-red-600 font-medium">{validationError}</p>}

                <button
                  type="submit"
                  className="w-full h-12 bg-primary text-white font-semibold text-sm rounded-lg flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer mt-2"
                >
                  Suivant
                  <Icon name="arrow_forward" className="text-[18px]" />
                </button>
              </form>
            )}

            {/* Step 2 Form */}
            {step === 2 && (
              <form onSubmit={handleNext} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="email">
                    Adresse Email <span className="text-red-500">*</span>
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
                    Numéro de téléphone{' '}
                    {role === 'FARMER' ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-gray-400 font-normal">(Optionnel)</span>
                    )}
                  </label>
                  <input
                    className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    type="tel"
                    placeholder={role === 'FARMER' ? '+243 990 000 000' : 'Ex: +243 990 000 000 (optionnel)'}
                    required={role === 'FARMER'}
                  />
                </div>

                {role === 'FARMER' ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="regionName">
                          Région d'activité <span className="text-red-500">*</span>
                        </label>
                        {regionsLoading && (
                          <span className="text-[10px] text-[#707970] animate-pulse">Chargement des régions...</span>
                        )}
                      </div>
                      <select
                        id="regionName"
                        value={regionName}
                        onChange={(e) => setRegionName(e.target.value)}
                        required
                        className="w-full bg-surface border border-[#c0c9be]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-on-surface"
                      >
                        <option value="">-- Sélectionnez votre région d'activité --</option>
                        {activeRegions.map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-[#707970] leading-tight mt-0.5">
                        Indiquez la région d'implantation de votre exploitation pour être rattaché au centre d'inspection local.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <AddressInputGroup
                        value={farmerAddress}
                        onChange={setFarmerAddress}
                        title="Adresse de l'exploitation"
                        subtitle="Localisation principale de vos parcelles et récoltes"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Billing Address */}
                    <div className="pt-2 border-t border-gray-100">
                      <AddressInputGroup
                        value={buyerBillingAddress}
                        onChange={(newAddr) => {
                          setBuyerBillingAddress(newAddr);
                          if (sameAsBilling) {
                            setBuyerShippingAddress(newAddr);
                          }
                          const cfg = countries.find((c) => c.countryCode === newAddr.country);
                          if (cfg) {
                            setBuyerPreferredCurrency(cfg.defaultCurrency);
                          }
                        }}
                        title="Adresse de facturation"
                        subtitle="Siège social ou adresse de contact"
                        required
                      />
                    </div>

                    {/* Supported currencies for the country in billing address */}
                    {countryConfig && countryConfig.supportedCurrencies.length > 1 && (
                      <div className="flex flex-col gap-1.5 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
                        <label className="text-[11px] font-semibold text-emerald-900">
                          Devise de facturation préférée :
                        </label>
                        <div className="flex items-center gap-3">
                          {countryConfig.supportedCurrencies.map((curr) => (
                            <label key={curr} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-emerald-950">
                              <input
                                type="radio"
                                name="buyerCurrency"
                                value={curr}
                                checked={buyerPreferredCurrency === curr}
                                onChange={() => setBuyerPreferredCurrency(curr)}
                                className="accent-emerald-600"
                              />
                              <span>{curr === 'USD' ? '$ USD (Dollar)' : 'FC CDF (Franc Congolais)'}</span>
                            </label>
                          ))}
                        </div>
                        <span className="text-[10px] text-emerald-700">
                          En RDC, vous pouvez choisir de régler vos achats en CDF ou en USD.
                        </span>
                      </div>
                    )}

                    {/* Same as billing checkbox */}
                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(e) => {
                            setSameAsBilling(e.target.checked);
                            if (e.target.checked) {
                              setBuyerShippingAddress(buyerBillingAddress);
                            }
                          }}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-[#c0c9be] cursor-pointer accent-[#004322]"
                        />
                        <span className="text-xs font-semibold text-on-surface">
                          L'adresse de livraison est identique à l'adresse de facturation
                        </span>
                      </label>
                    </div>

                    {/* Separate Shipping Address */}
                    {!sameAsBilling && (
                      <div className="pt-2 border-t border-gray-100">
                        <AddressInputGroup
                          value={buyerShippingAddress}
                          onChange={setBuyerShippingAddress}
                          title="Adresse de livraison"
                          subtitle="Entrepôt, magasin ou point de déchargement"
                          required
                        />
                      </div>
                    )}
                  </>
                )}

                {validationError && <p className="text-xs text-red-600 font-medium">{validationError}</p>}

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
                    <Icon name="arrow_forward" className="text-[18px]" />
                  </button>
                </div>
              </form>
            )}

            {/* Step 3 Form */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="password">
                    Mot de passe <span className="text-red-500">*</span>
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
                    Confirmer le mot de passe <span className="text-red-500">*</span>
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

                {role === 'FARMER' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-on-surface-variant" htmlFor="bio">
                      Présentation de l'exploitation <span className="text-gray-400 font-normal">(Optionnel)</span>
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

                {validationError && <p className="text-xs text-red-600 font-medium">{validationError}</p>}
                {serverError && (
                  <p className="text-xs text-red-600 font-medium">
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
                    <Icon name="arrow_forward" className="text-[18px]" />
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
