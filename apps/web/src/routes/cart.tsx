import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getBasketQuery,
  updateBasketLineMutation,
  removeBasketLineMutation,
} from '@/features/basket/api/basket.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import {
  formatCurrencyPrice,
  formatPriceDirect,
  convertFromUSD,
  useCurrencyStore,
} from '@/features/currency/store/currency.store';
import { fetchActiveFees } from '@/features/fees/api/fees.api';
import {
  BasketLineDto,
  HarvestUnit,
  FeeCalculationType,
  ProductCategory,
} from '@futurefarm/types';

export const Route = createFileRoute('/cart')({
  beforeLoad: () => {
    requireAuth();
  },
  component: CartPage,
});

const categoryLabel = (cat?: ProductCategory | string): string => {
  switch (cat) {
    case 'VEGETABLES':
      return 'Légumes';
    case 'DAIRY':
      return 'Crèmerie';
    case 'FRUITS':
      return 'Fruits';
    case 'CEREALS':
      return 'Céréales';
    case 'DATES':
      return 'Dattes';
    case 'MEAT':
      return 'Viandes';
    default:
      return 'Produits frais';
  }
};

const unitLabel = (unit?: HarvestUnit | string): string => {
  switch (unit) {
    case 'KG':
      return 'kg';
    case 'PIECE':
      return 'pce';
    case 'TON':
      return 'tonne';
    default:
      return unit?.toLowerCase() || 'unité';
  }
};

const getDaysUntilExpiration = (expirationDate?: string | Date): number | null => {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate).getTime();
  const now = Date.now();
  const diff = exp - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

interface ProducerGroup {
  producerId: string;
  name: string;
  address: string;
  avatarUrl?: string | null;
  isCertified: boolean;
  lines: BasketLineDto[];
  subtotal: number;
}

function CartItemCard({
  line,
  refetch,
}: {
  line: BasketLineDto;
  refetch: () => void;
}) {
  const updateQty = useMutation({
    ...updateBasketLineMutation(line.id),
    onSuccess: () => {
      void refetch();
    },
    onError: () => {
      addToast('Erreur lors de la mise à jour', 'error');
    },
  });

  const removeLine = useMutation({
    ...removeBasketLineMutation(line.id),
    onSuccess: () => {
      addToast('Article retiré du panier', 'success');
      void refetch();
    },
    onError: () => {
      addToast('Erreur lors de la suppression', 'error');
    },
  });

  const productName = line.harvest?.product?.name || `Produit #${line.harvestId.slice(0, 8)}`;
  const unitPrice = Number(line.harvest?.pricePerUnit ?? 0);
  const subtotal = unitPrice * Number(line.quantity);
  const photoUrl =
    line.harvest?.photoUrls?.[0] ||
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80';
  const category = categoryLabel(line.harvest?.product?.category);
  const unit = unitLabel(line.harvest?.unit);
  const qualityScore = line.harvest?.qualityScore
    ? Math.round(Number(line.harvest.qualityScore))
    : 98;

  const daysUntilExpiration = getDaysUntilExpiration(line.harvest?.expirationDate);
  const isExpiringSoon =
    daysUntilExpiration !== null && daysUntilExpiration <= 3 && daysUntilExpiration >= 0;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm space-y-3">
      {/* Top Section */}
      <div className="flex gap-3.5">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#f1f5f9] border border-gray-100">
          <img
            src={photoUrl}
            alt={productName}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-block bg-[#f1f5f9] text-[#475569] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              {category}
            </span>
            <button
              type="button"
              onClick={() => removeLine.mutate()}
              disabled={removeLine.isPending}
              className="text-[#dc2626] hover:text-[#b91c1c] p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40"
              aria-label="Supprimer cet article"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>

          <h3 className="text-sm font-bold text-[#0b1c30] truncate mt-0.5">{productName}</h3>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="bg-[#e6f4ea] text-[#137333] font-semibold text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>★</span>
              <span>Score IA: {qualityScore}</span>
            </span>
            <span className="text-xs font-semibold text-[#475569]">
              {formatCurrencyPrice(unitPrice, line.harvest?.currency || 'CDF')} / {unit}
            </span>
          </div>
        </div>
      </div>

      {/* Expiration Warning Banner */}
      {isExpiringSoon && (
        <div className="bg-[#fffbeb] border border-[#fef3c7] rounded-xl p-2.5 flex items-start gap-2 text-xs text-[#92400e]">
          <span className="material-symbols-outlined text-[18px] text-[#d97706] shrink-0 mt-0.5">
            warning
          </span>
          <p className="leading-snug">
            Ce produit expire dans {daysUntilExpiration} jour
            {daysUntilExpiration > 1 ? 's' : ''} — commandez rapidement pour garantir la fraîcheur.
          </p>
        </div>
      )}

      {/* Bottom Row: Stepper & Subtotal */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        {/* Stepper */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (line.quantity > 1) {
                updateQty.mutate({ quantity: line.quantity - 1 });
              }
            }}
            disabled={line.quantity <= 1 || updateQty.isPending}
            className="w-7 h-7 rounded-lg border border-[#c0c9be] flex items-center justify-center text-[#0b1c30] hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Diminuer la quantité"
          >
            <span className="material-symbols-outlined text-[16px]">remove</span>
          </button>
          <span className="w-8 text-center text-sm font-bold text-[#0b1c30]">
            {line.quantity}
          </span>
          <button
            type="button"
            onClick={() => {
              updateQty.mutate({ quantity: line.quantity + 1 });
            }}
            disabled={updateQty.isPending}
            className="w-7 h-7 rounded-lg border border-[#c0c9be] flex items-center justify-center text-[#0b1c30] hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Augmenter la quantité"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>

        {/* Subtotal */}
        <span className="text-base font-extrabold text-[#0b1c30]">
          {formatCurrencyPrice(subtotal, line.harvest?.currency || 'CDF')}
        </span>
      </div>
    </div>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const { data: basket, refetch } = useQuery(getBasketQuery());
  const [promoInput, setPromoInput] = useState('');
  const [discount, setDiscount] = useState(0);

  const rawLines = basket?.lines || [];

  // Group lines by producer
  const producerGroups = useMemo(() => {
    if (!rawLines || rawLines.length === 0) return [];

    const groupMap = new Map<string, ProducerGroup>();

    for (const line of rawLines) {
      const producer = line.harvest?.farmerProfile;
      const producerId = producer?.id || line.harvest?.farmerProfileId || 'default-producer';
      const name = producer?.companyName || 'Ferme locale';
      const address = producer?.address || 'France';
      const avatarUrl =
        producer?.avatarUrl ||
        'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=120&q=80';
      const isCertified = producer?.isCertified ?? true;

      const unitPrice = Number(line.harvest?.pricePerUnit ?? 0);
      const lineTotal = unitPrice * Number(line.quantity);

      if (!groupMap.has(producerId)) {
        groupMap.set(producerId, {
          producerId,
          name,
          address,
          avatarUrl,
          isCertified,
          lines: [],
          subtotal: 0,
        });
      }

      const group = groupMap.get(producerId)!;
      group.lines.push(line);
      group.subtotal += lineTotal;
    }

    return Array.from(groupMap.values());
  }, [rawLines]);

  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const currencies = useCurrencyStore((s) => s.currencies);

  const itemsSubtotal = useMemo(() => {
    return rawLines.reduce((sum, line) => {
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
  }, [rawLines, selectedCurrency, currencies]);

  const { data: activeFees = [] } = useQuery({
    queryKey: ['platform-fees-active'],
    queryFn: fetchActiveFees,
    staleTime: 60000,
  });

  const calculatedFees = useMemo(() => {
    if (rawLines.length === 0) return [];
    if (activeFees.length > 0) {
      return activeFees.map((fee) => {
        let amount = 0;
        if (fee.calculationType === FeeCalculationType.FIXED) {
          amount = convertFromUSD(Number(fee.value), selectedCurrency);
        } else if (fee.calculationType === FeeCalculationType.PERCENTAGE) {
          amount = Number(((itemsSubtotal * Number(fee.value)) / 100).toFixed(2));
        }
        return {
          id: fee.id,
          name: fee.name,
          code: fee.code,
          calculatedAmount: amount,
        };
      });
    }
    // Fallback default fees if not loaded
    return [
      { id: 'def-del', name: 'Frais livraison', code: 'DELIVERY', calculatedAmount: convertFromUSD(2.90, selectedCurrency) },
      { id: 'def-srv', name: 'Frais service', code: 'SERVICE', calculatedAmount: convertFromUSD(0.50, selectedCurrency) },
    ];
  }, [activeFees, rawLines.length, itemsSubtotal, selectedCurrency]);

  const totalFees = calculatedFees.reduce((sum, f) => sum + f.calculatedAmount, 0);
  const totalTTC = Math.max(0, itemsSubtotal + totalFees - discount);

  const handleApplyPromo = () => {
    if (!promoInput.trim()) {
      addToast('Veuillez entrer un code promo', 'error');
      return;
    }

    const cleanCode = promoInput.trim().toUpperCase();
    if (cleanCode === 'BIO10' || cleanCode === 'FRESH' || cleanCode === 'FUTURE') {
      const promoAmount = Number((itemsSubtotal * 0.1).toFixed(2));
      setDiscount(promoAmount);
      addToast(`Code appliqué : -${formatPriceDirect(promoAmount, selectedCurrency)}`, 'success');
    } else {
      const discountVal = convertFromUSD(2.00, selectedCurrency);
      setDiscount(discountVal);
      addToast(`Code promo appliqué : -${formatPriceDirect(discountVal, selectedCurrency)}`, 'success');
    }
  };

  const subtitle =
    rawLines.length === 0
      ? '0 article'
      : `${rawLines.length} article${rawLines.length > 1 ? 's' : ''} de ${producerGroups.length} producteur${producerGroups.length > 1 ? 's' : ''}`;

  return (
    <div className="bg-[#f8f9fc] text-[#0b1c30] min-h-screen pb-24 font-sans">
      <BuyerHeader
        title="Mon Panier"
        subtitle={subtitle}
        showBack
        backTo="/marketplace"
        hideCart
      />

      {/* Main Content */}
      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-5">
        {rawLines.length === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#e6f4ea] flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-[32px] text-[#004322]">
                shopping_cart
              </span>
            </div>
            <h2 className="text-base font-bold text-[#0b1c30] mb-1">Votre panier est vide</h2>
            <p className="text-xs text-[#707970] mb-5">
              Explorez les récoltes fraîches du terroir et commandez en direct des producteurs.
            </p>
            <Link
              to="/marketplace"
              className="inline-block px-6 py-3 bg-[#004322] hover:bg-[#1a5c35] text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
            >
              Découvrir le marché
            </Link>
          </div>
        ) : (
          <>
            {/* Producers & Items */}
            <div className="space-y-6">
              {producerGroups.map((producer) => (
                <section key={producer.producerId} className="space-y-3">
                  {/* Producer Header */}
                  <div className="flex items-center gap-3 px-1">
                    <img
                      src={producer.avatarUrl || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=120&q=80'}
                      alt={producer.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#e2e8f0] shadow-sm shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-[#0b1c30] truncate">
                          {producer.name}
                        </h2>
                        {producer.isCertified && (
                          <span
                            className="material-symbols-outlined text-[16px] text-[#004322] shrink-0"
                            title="Producteur certifié"
                          >
                            verified
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#707970] truncate">{producer.address}</p>
                    </div>
                  </div>

                  {/* Product Cards for Producer */}
                  <div className="space-y-3">
                    {producer.lines.map((line) => (
                      <CartItemCard key={line.id} line={line} refetch={refetch} />
                    ))}
                  </div>

                  {/* Producer Subtotal */}
                  <div className="text-right pt-1 pb-1 px-1">
                    <span className="text-xs font-bold text-[#0b1c30]">
                      Sous-total producteur :{' '}
                      <span className="font-extrabold">
                        {formatCurrencyPrice(producer.subtotal, producer.lines[0]?.harvest?.currency || 'CDF')}
                      </span>
                    </span>
                  </div>
                </section>
              ))}
            </div>

            {/* Order Summary Card ("Récapitulatif") */}
            <section className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0b1c30]">Récapitulatif</h3>
                <div className="flex items-center gap-2 text-[#707970]">
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  <span className="material-symbols-outlined text-[18px]">credit_card</span>
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                </div>
              </div>

              {/* Breakdown lines */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#475569]">
                  <span>Sous-total</span>
                  <span className="font-semibold text-[#0b1c30]">{formatPriceDirect(itemsSubtotal, selectedCurrency)}</span>
                </div>
                {calculatedFees.map((fee) => (
                  <div key={fee.id} className="flex justify-between text-[#475569]">
                    <span>{fee.name}</span>
                    <span className="font-semibold text-[#0b1c30]">{formatPriceDirect(fee.calculatedAmount, selectedCurrency)}</span>
                  </div>
                ))}
                {discount > 0 && (
                  <div className="flex justify-between text-[#137333]">
                    <span>Réduction code promo</span>
                    <span className="font-semibold">-{formatPriceDirect(discount, selectedCurrency)}</span>
                  </div>
                )}
              </div>

              {/* Promo Code Input Box */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Code promo"
                    className="w-full bg-[#f1f5f9] border border-transparent focus:border-[#004322] rounded-xl px-3.5 py-2 text-sm text-[#0b1c30] placeholder-[#707970] outline-none transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="bg-[#e6f4ea] hover:bg-[#cbf0d8] text-[#137333] font-bold text-sm px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Appliquer
                </button>
              </div>

              {/* Total TTC & Delivery Time */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div>
                  <span className="text-sm font-bold text-[#0b1c30] block">Total TTC</span>
                  <span className="text-xs text-[#059669] font-medium flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    <span>Demain avant 14h</span>
                  </span>
                </div>
                <span className="text-2xl font-black text-[#004322]">{formatPriceDirect(totalTTC, selectedCurrency)}</span>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={() => navigate({ to: '/checkout' })}
                className="w-full py-3.5 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all"
              >
                <span>Procéder au paiement</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
