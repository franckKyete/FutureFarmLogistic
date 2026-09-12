import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getBasketQuery,
  checkoutMutation,
} from '@/features/basket/api/basket.queries';
import { confirmPaymentMutation } from '@/features/orders/api/orders.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import {
  useCurrencyStore,
  convertFromUSD,
  formatPriceDirect,
} from '@/features/currency/store/currency.store';
import { fetchActiveFees } from '@/features/fees/api/fees.api';
import {
  FeeCalculationType,
  type DeliveryAddress,
  type BasketLineDto,
  type OrderDto,
} from '@futurefarm/types';

export const Route = createFileRoute('/checkout')({
  beforeLoad: () => {
    requireAuth();
  },
  component: CheckoutPage,
});

const DEFAULT_SAVED_ADDRESSES = [
  '12 Rue des Agriculteurs, Kinshasa',
  '45 Avenue de la Paix, Dakar',
  '8 Boulevard de la République, Abidjan',
];

type DeliverySlot = 'Matin (08:00 - 12:00)' | 'Après-midi' | 'Soir';

function parseFullAddress(fullAddress: string, defaultCountry = 'COD'): DeliveryAddress {
  const parts = fullAddress.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    return {
      street: parts[0] || '12 Rue des Agriculteurs',
      city: parts[1] || 'Kinshasa',
      country: parts[2] || defaultCountry,
      postalCode: '10000',
    };
  }
  return {
    street: fullAddress || '12 Rue des Agriculteurs',
    city: 'Kinshasa',
    country: defaultCountry,
    postalCode: '10000',
  };
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0] ?? '';
}

export function CheckoutPage() {
  const { data: basket, refetch: refetchBasket } = useQuery(getBasketQuery());

  // Checkout Steps: 1 = Livraison, 2 = Paiement, 3 = Confirmation
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [addressInput, setAddressInput] = useState('12 Rue des Agriculteurs, Dakar');
  const [deliveryDate, setDeliveryDate] = useState(getTomorrowDate());
  const [selectedSlot, setSelectedSlot] = useState<DeliverySlot>('Matin (08:00 - 12:00)');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Saved addresses list
  const [savedAddresses, setSavedAddresses] = useState<string[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  // Payment Method Selection (Step 2)
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'mobile_money'>('stripe');

  // Placed Order Result State (Step 3)
  const [placedOrder, setPlacedOrder] = useState<OrderDto | null>(null);

  // Load saved addresses from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('futurefarm_saved_addresses');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedAddresses(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setSavedAddresses(DEFAULT_SAVED_ADDRESSES);
  }, []);

  // Save new address automatically
  const persistAddress = (addr: string) => {
    const trimmed = addr.trim();
    if (!trimmed) return;
    setSavedAddresses((prev) => {
      const filtered = prev.filter((a) => a.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('futurefarm_saved_addresses', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const selectedCountry = useCurrencyStore((s) => s.selectedCountry);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const currencies = useCurrencyStore((s) => s.currencies);

  const { data: activeFees = [] } = useQuery({
    queryKey: ['platform-fees-active'],
    queryFn: fetchActiveFees,
    staleTime: 60000,
  });

  const lines: BasketLineDto[] = basket?.lines || [];
  const totalPrice = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => {
      const price = Number(line.harvest?.pricePerUnit ?? 0);
      const sourceCurrency = line.harvest?.currency || 'CDF';
      const lineTotal = price * Number(line.quantity);
      if (sourceCurrency === selectedCurrency) {
        return sum + lineTotal;
      }
      const sourceRate = currencies.find((c) => c.code === sourceCurrency)?.rateAgainstBase ?? 1.0;
      const targetRate = currencies.find((c) => c.code === selectedCurrency)?.rateAgainstBase ?? 1.0;
      return sum + (lineTotal / sourceRate) * targetRate;
    }, 0);

    if (subtotal === 0) return 0;

    let totalFees = 0;
    if (activeFees.length > 0) {
      for (const fee of activeFees) {
        if (fee.calculationType === FeeCalculationType.FIXED) {
          totalFees += convertFromUSD(Number(fee.value), selectedCurrency);
        } else if (fee.calculationType === FeeCalculationType.PERCENTAGE) {
          totalFees += Number(((subtotal * Number(fee.value)) / 100).toFixed(2));
        }
      }
    } else {
      // Fallback
      totalFees = convertFromUSD(2.90, selectedCurrency) + convertFromUSD(0.50, selectedCurrency);
    }

    return subtotal + totalFees;
  }, [lines, selectedCurrency, currencies, activeFees]);

  const formattedTotal = formatPriceDirect(totalPrice, selectedCurrency);

  const confirmPayment = useMutation({
    ...confirmPaymentMutation(),
  });

  const checkout = useMutation({
    ...checkoutMutation(),
    onSuccess: async (data) => {
      // If payment gateway provides a redirect URL (e.g. Stripe Checkout or PawaPay), redirect immediately
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      if (data?.order) {
        setPlacedOrder(data.order as unknown as OrderDto);
        void refetchBasket();
        setCurrentStep(3);
        addToast('Commande enregistrée. En attente de paiement.', 'info');
        return;
      }

      addToast('Erreur : URL de paiement non reçue du serveur', 'error');
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Erreur lors de la confirmation de la commande';
      addToast(message, 'error');
    },
  });

  const handleStep1Submit = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    if (!addressInput.trim()) {
      addToast('Veuillez renseigner une adresse de livraison', 'error');
      return;
    }
    persistAddress(addressInput);
    setCurrentStep(2);
  };

  const handleExecutePayment = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault?.();
    if (lines.length === 0) {
      addToast('Votre panier est vide', 'error');
      return;
    }

    const parsedAddress = parseFullAddress(addressInput, selectedCountry);
    const combinedNotes = `Date: ${deliveryDate} | Créneau: ${selectedSlot}${specialInstructions.trim() ? ` | Instructions: ${specialInstructions.trim()}` : ''}`;

    checkout.mutate({
      deliveryAddress: parsedAddress,
      notes: combinedNotes,
      paymentMethod,
      currency: selectedCurrency,
    });
  };

  return (
    <div className="bg-[#f8f9fc] text-[#0b1c30] min-h-screen pb-32 font-sans">
      <BuyerHeader
        title={
          currentStep === 1
            ? 'Finaliser la commande'
            : currentStep === 2
              ? 'Paiement sécurisé'
              : 'Confirmation'
        }
        showBack
        backTo={currentStep === 1 ? '/cart' : undefined}
        hideCart
      />

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-5">
        {/* ── 3-Step Progress Stepper ── */}
        <div className="flex items-center justify-between px-2 py-3 bg-white rounded-2xl border border-[#e2e8f0] shadow-sm">
          {/* Step 1: Livraison */}
          <div
            onClick={() => currentStep > 1 && setCurrentStep(1)}
            className={`flex flex-col items-center gap-1.5 flex-1 ${
              currentStep >= 1 ? 'cursor-pointer' : ''
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                currentStep === 1
                  ? 'bg-[#004322] text-white shadow-sm'
                  : currentStep > 1
                    ? 'bg-[#e6f4ea] text-[#004322]'
                    : 'bg-gray-100 text-[#707970]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {currentStep > 1 ? 'check' : 'local_shipping'}
              </span>
            </div>
            <span
              className={`text-[11px] font-bold ${
                currentStep === 1
                  ? 'text-[#004322]'
                  : currentStep > 1
                    ? 'text-[#004322]'
                    : 'text-[#707970]'
              }`}
            >
              Livraison
            </span>
          </div>

          {/* Divider 1-2 */}
          <div
            className={`h-[2px] flex-1 -mt-4 transition-colors ${
              currentStep >= 2 ? 'bg-[#004322]' : 'bg-[#e2e8f0]'
            }`}
          />

          {/* Step 2: Paiement */}
          <div
            onClick={() => currentStep === 3 && setCurrentStep(2)}
            className={`flex flex-col items-center gap-1.5 flex-1 ${
              currentStep === 3 ? 'cursor-pointer' : ''
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                currentStep === 2
                  ? 'bg-[#004322] text-white shadow-sm'
                  : currentStep > 2
                    ? 'bg-[#e6f4ea] text-[#004322]'
                    : 'bg-gray-100 text-[#707970]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {currentStep > 2 ? 'check' : 'payments'}
              </span>
            </div>
            <span
              className={`text-[11px] font-bold ${
                currentStep === 2
                  ? 'text-[#004322]'
                  : currentStep > 2
                    ? 'text-[#004322]'
                    : 'text-[#707970]'
              }`}
            >
              Paiement
            </span>
          </div>

          {/* Divider 2-3 */}
          <div
            className={`h-[2px] flex-1 -mt-4 transition-colors ${
              currentStep === 3 ? 'bg-[#004322]' : 'bg-[#e2e8f0]'
            }`}
          />

          {/* Step 3: Confirmation */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                currentStep === 3
                  ? 'bg-[#004322] text-white shadow-sm'
                  : 'bg-gray-100 text-[#707970]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
            <span
              className={`text-[11px] font-bold ${
                currentStep === 3 ? 'text-[#004322]' : 'text-[#707970]'
              }`}
            >
              Confirmation
            </span>
          </div>
        </div>

        {/* ── STEP 1: FORMULAIRE DE LIVRAISON ── */}
        {currentStep === 1 && (
          <form id="checkout-step1-form" onSubmit={handleStep1Submit} className="space-y-4">
            <div className="bg-white border border-[#c0c9be] rounded-2xl p-5 space-y-4 shadow-sm">
              {/* Adresse de livraison */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#004322]">
                    Adresse de livraison
                  </label>
                  {savedAddresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddressDropdown(!showAddressDropdown)}
                      className="text-[11px] font-semibold text-[#1a5c35] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">history</span>
                      <span>Adresses enregistrées ({savedAddresses.length})</span>
                    </button>
                  )}
                </div>

                {/* Saved addresses selector */}
                {showAddressDropdown && savedAddresses.length > 0 && (
                  <div className="mb-2 p-2 bg-[#f8f9fc] border border-[#e2e8f0] rounded-xl space-y-1.5">
                    <p className="text-[10px] font-bold text-[#707970] uppercase px-1">
                      Choisir une adresse enregistrée :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {savedAddresses.map((addr, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setAddressInput(addr);
                            setShowAddressDropdown(false);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border text-left truncate max-w-full transition-all cursor-pointer ${
                            addressInput === addr
                              ? 'bg-[#004322] text-white border-[#004322] font-semibold'
                              : 'bg-white border-[#c0c9be] text-[#0b1c30] hover:border-[#004322]'
                          }`}
                        >
                          📍 {addr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Address Input */}
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[#707970] text-[20px] pointer-events-none">
                    location_on
                  </span>
                  <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    placeholder="12 Rue des Agriculteurs, Dakar"
                    className="w-full h-12 pl-10 pr-4 bg-white border border-[#c0c9be] rounded-xl text-sm font-medium text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322] transition-all"
                    required
                  />
                </div>
              </div>

              {/* Date de livraison */}
              <div>
                <label className="text-xs font-bold text-[#004322] block mb-1.5">
                  Date de livraison
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full h-12 px-4 bg-white border border-[#c0c9be] rounded-xl text-sm font-medium text-[#0b1c30] focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322] transition-all"
                  required
                />
              </div>

              {/* Créneau de livraison */}
              <div>
                <label className="text-xs font-bold text-[#004322] block mb-1.5">
                  Créneau de livraison
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['Matin (08:00 - 12:00)', 'Après-midi', 'Soir'] as DeliverySlot[]).map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#004322] text-white shadow-sm'
                            : 'bg-white border border-[#c0c9be] text-[#0b1c30] hover:border-[#004322]'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Instructions spéciales */}
              <div>
                <label className="text-xs font-bold text-[#004322] block mb-1.5">
                  Instructions spéciales
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Ex: Code porte, étage, point de repère..."
                  rows={3}
                  className="w-full p-3.5 bg-white border border-[#c0c9be] rounded-xl text-xs text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322] transition-all resize-none"
                />
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center justify-center gap-3 text-[11px] text-[#707970] pt-1">
                <span className="flex items-center gap-1 font-semibold text-[#9a3412]">
                  <span className="material-symbols-outlined text-[15px]">schedule</span>
                  <span>Livré sous 24h</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-[#004322]">
                  <span className="material-symbols-outlined text-[15px]">lock</span>
                  <span>Paiement sécurisé</span>
                </span>
              </div>
            </div>
          </form>
        )}

        {/* ── STEP 2: PAGE DE PAIEMENT AUTO-HÉBERGÉE (SELF-HOSTED) ── */}
        {currentStep === 2 && (
          <form id="checkout-step2-form" onSubmit={handleExecutePayment} className="space-y-4">
            {/* Delivery Recap Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs font-bold text-[#707970] uppercase">Récapitulatif livraison</span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-bold text-[#1a5c35] hover:underline cursor-pointer"
                >
                  Modifier
                </button>
              </div>
              <div className="text-xs text-[#404941] space-y-1">
                <p className="font-semibold text-[#0b1c30]">📍 {addressInput}</p>
                <p>🕒 {deliveryDate} — {selectedSlot}</p>
                {specialInstructions.trim() && (
                  <p className="text-[#707970] italic">Note : {specialInstructions}</p>
                )}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-white border border-[#c0c9be] rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#004322]">
                Choisir le mode de paiement
              </h3>

              <div className="space-y-2.5">
                {/* Stripe Card Option */}
                <div
                  onClick={() => setPaymentMethod('stripe')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === 'stripe'
                      ? 'border-[#004322] bg-[#f2f9f5] ring-1 ring-[#004322]'
                      : 'border-[#e2e8f0] bg-white hover:border-[#c0c9be]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-[#004322]">
                      {paymentMethod === 'stripe' && (
                        <div className="w-2.5 h-2.5 bg-[#004322] rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0b1c30]">Carte bancaire (Stripe)</p>
                      <p className="text-[11px] text-[#707970]">Visa, Mastercard, Cartes Internationales</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#707970]">
                    <span className="material-symbols-outlined text-[20px]">credit_card</span>
                  </div>
                </div>

                {/* Mobile Money Option */}
                <div
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === 'mobile_money'
                      ? 'border-[#004322] bg-[#f2f9f5] ring-1 ring-[#004322]'
                      : 'border-[#e2e8f0] bg-white hover:border-[#c0c9be]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-[#004322]">
                      {paymentMethod === 'mobile_money' && (
                        <div className="w-2.5 h-2.5 bg-[#004322] rounded-full" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0b1c30]">Mobile Money</p>
                      <p className="text-[11px] text-[#707970]">Wave, Orange Money, Free Money</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[#707970] text-[20px]">
                    phone_android
                  </span>
                </div>
              </div>

              {/* Informative Banner for Stripe Redirection */}
              {paymentMethod === 'stripe' && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl flex items-start gap-2.5 text-xs text-[#004322]">
                    <span className="material-symbols-outlined text-[20px] text-[#004322] shrink-0 mt-0.5">
                      open_in_new
                    </span>
                    <div>
                      <p className="font-bold">Redirection vers Stripe</p>
                      <p className="text-[11px] text-[#404941] mt-0.5 leading-relaxed">
                        Vous serez redirigé vers la page sécurisée de Stripe pour saisir vos coordonnées bancaires en toute sécurité et finaliser votre règlement.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Informative Banner for PawaPay Redirection & Whole-Number Rounding */}
              {paymentMethod === 'mobile_money' && (
                <div className="pt-3 border-t border-gray-100 space-y-2.5">
                  <div className="p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl flex items-start gap-2.5 text-xs text-[#004322]">
                    <span className="material-symbols-outlined text-[20px] text-[#004322] shrink-0 mt-0.5">
                      open_in_new
                    </span>
                    <div>
                      <p className="font-bold">Paiement Mobile Money via PawaPay</p>
                      <p className="text-[11px] text-[#404941] mt-0.5 leading-relaxed">
                        Vous serez redirigé vers la page sécurisée PawaPay pour sélectionner votre opérateur (Wave, Orange Money, Free Money), renseigner votre numéro et valider.
                      </p>
                    </div>
                  </div>

                  {/* Whole-number rounding notice if amount has decimals */}
                  {totalPrice % 1 !== 0 && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                      <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">
                        info
                      </span>
                      <div className="space-y-0.5">
                        <p className="font-bold">Ajustement du montant Mobile Money</p>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Les opérateurs Mobile Money requièrent des montants entiers stricts. Votre règlement sera arrondi au supérieur à{' '}
                          <strong className="font-extrabold text-[#004322]">
                            {formatPriceDirect(Math.ceil(totalPrice), selectedCurrency)}
                          </strong>{' '}
                          lors du prélèvement.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trust Indicators */}
              <div className="flex items-center justify-center gap-3 text-[11px] text-[#707970] pt-1">
                <span className="flex items-center gap-1 font-semibold text-[#9a3412]">
                  <span className="material-symbols-outlined text-[15px]">schedule</span>
                  <span>Livré sous 24h</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-[#004322]">
                  <span className="material-symbols-outlined text-[15px]">lock</span>
                  <span>
                    {paymentMethod === 'mobile_money'
                      ? 'Paiement sécurisé par PawaPay (Mobile Money)'
                      : 'Paiement sécurisé et crypté (Stripe)'}
                  </span>
                </span>
              </div>
            </div>
          </form>
        )}

        {/* ── STEP 3: CONFIRMATION ÉCRAN ── */}
        {currentStep === 3 && (
          <div className="bg-white border border-[#c0c9be] rounded-2xl p-6 text-center shadow-sm space-y-5">
            <div className="w-16 h-16 rounded-full bg-[#e6f4ea] text-[#004322] flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>

            <div>
              <h2 className="text-lg font-black text-[#0b1c30]">Commande confirmée !</h2>
              <p className="text-xs text-[#707970] mt-1">
                Merci pour votre confiance. Votre commande est transmise aux producteurs partenaires.
              </p>
            </div>

            {placedOrder && (
              <div className="bg-[#f8f9fc] border border-[#e2e8f0] rounded-xl p-4 text-left text-xs space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-[#707970] font-semibold">Référence</span>
                  <span className="font-bold text-[#0b1c30]">#{placedOrder.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-[#707970] font-semibold">Montant payé</span>
                  <span className="font-extrabold text-[#004322]">{formatPriceDirect(placedOrder.totalAmount, placedOrder.currency)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-[#707970] font-semibold">Date prévue</span>
                  <span className="font-bold text-[#0b1c30]">{deliveryDate} ({selectedSlot})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#707970] font-semibold">Livraison</span>
                  <span className="font-bold text-[#0b1c30] truncate max-w-[200px]">
                    {addressInput}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              {placedOrder ? (
                <Link
                  to="/orders/$id"
                  params={{ id: placedOrder.id }}
                  className="w-full py-3.5 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-sm transition-all shadow-sm block text-center cursor-pointer"
                >
                  Suivre ma commande
                </Link>
              ) : (
                <Link
                  to="/orders"
                  className="w-full py-3.5 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-sm transition-all shadow-sm block text-center cursor-pointer"
                >
                  Suivre ma commande
                </Link>
              )}
              <Link
                to="/marketplace"
                className="w-full py-3 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0b1c30] font-bold rounded-xl text-sm transition-all block text-center cursor-pointer"
              >
                Retour au marché
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* ── Fixed Bottom Summary Bar with Pay / Continue Action ── */}
      {currentStep < 3 && (
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#c0c9be] shadow-lg">
          <div className="max-w-[480px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="shrink-0">
              <span className="text-[10px] font-bold text-[#707970] uppercase block">
                TOTAL À PAYER
              </span>
              <span className="text-xl font-black text-[#004322] leading-tight block">
                {formattedTotal}
              </span>
            </div>

            {currentStep === 1 && (
              <button
                type="submit"
                form="checkout-step1-form"
                data-testid="continue-button"
                disabled={lines.length === 0}
                onClick={handleStep1Submit}
                className="flex-1 py-3.5 px-4 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                <span>Continuer vers le paiement</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="submit"
                form="checkout-step2-form"
                data-testid="pay-button"
                disabled={checkout.isPending || confirmPayment.isPending}
                onClick={handleExecutePayment}
                className="flex-1 py-3.5 px-4 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
              >
                {checkout.isPending || confirmPayment.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Traitement...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                    <span>
                      {paymentMethod === 'stripe'
                        ? `Payer avec Stripe (${formattedTotal})`
                        : `Payer avec Mobile Money (${formatPriceDirect(Math.ceil(totalPrice), selectedCurrency)})`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
