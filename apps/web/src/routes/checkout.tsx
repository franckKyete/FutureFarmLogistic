import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getBasketQuery,
  checkoutMutation,
} from '@/features/basket/api/basket.queries';
import { addToast } from '@/features/shared/store/toast.store';
import type { DeliveryAddress, BasketLineDto } from '@futurefarm/types';

export const Route = createFileRoute('/checkout')({
  beforeLoad: () => {
    requireAuth();
  },
  component: CheckoutPage,
});

// API returns harvest + product relations even though the base DTO doesn't declare them
interface EnrichedLine extends BasketLineDto {
  harvest?: {
    id: string;
    pricePerUnit: number;
    unit: string;
    product?: {
      id: string;
      name: string;
    };
    photoUrls?: string[];
  };
}

function CheckoutPage() {
  const navigate = useNavigate();
  const { data: basket } = useQuery(getBasketQuery());

  const [address, setAddress] = useState<DeliveryAddress>({
    street: '',
    city: '',
    postalCode: '',
    country: 'Tunisie',
  });
  const [notes, setNotes] = useState('');

  const checkout = useMutation({
    ...checkoutMutation(),
    onSuccess: () => {
      addToast('Commande confirmée !', 'success');
      navigate({ to: '/orders' });
    },
    onError: () => {
      addToast('Erreur lors de la confirmation de la commande', 'error');
    },
  });

  const lines: EnrichedLine[] = (basket?.lines as EnrichedLine[]) || [];
  const totalPrice = lines.reduce((sum, line) => {
    return sum + (line.harvest?.pricePerUnit ?? 0) * line.quantity;
  }, 0);
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);

  const isAddressValid =
    address.street.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.postalCode.trim().length > 0 &&
    address.country.trim().length > 0;

  const handleAddressChange = (
    field: keyof DeliveryAddress,
    value: string,
  ) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddressValid) return;
    checkout.mutate({
      deliveryAddress: address,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex items-center px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/cart"
            className="material-symbols-outlined text-[#004322] cursor-pointer"
          >
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322]">
            Validation
          </h1>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-4">
        {/* Order Summary */}
        <section className="bg-white border border-[#c0c9be] rounded-xl p-4">
          <h2 className="text-[15px] font-bold text-[#0b1c30] mb-3">
            Récapitulatif
          </h2>
          {lines.length === 0 ? (
            <p className="text-[#707970] text-[13px]">Aucun article dans le panier.</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => {
                const unitPrice = line.harvest?.pricePerUnit ?? 0;
                const productName = line.harvest?.product?.name || `Produit #${line.harvestId.slice(0, 8)}`;
                const subtotal = unitPrice * line.quantity;
                return (
                  <div
                    key={line.id}
                    className="flex items-center justify-between text-[13px]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0b1c30] font-semibold truncate">
                        {productName}
                      </p>
                      <p className="text-[#707970] text-[12px]">
                        {line.quantity} x {unitPrice.toLocaleString()} FCFA
                      </p>
                    </div>
                    <span className="text-[#0b1c30] font-bold ml-4">
                      {subtotal.toLocaleString()} FCFA
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-[#c0c9be] pt-3 flex justify-between items-center">
                <span className="text-[14px] font-semibold text-[#0b1c30]">
                  Total ({totalItems} articles)
                </span>
                <span className="text-[16px] font-bold text-[#004322]">
                  {totalPrice.toLocaleString()} FCFA
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Delivery Address Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="bg-white border border-[#c0c9be] rounded-xl p-4 space-y-3">
            <h2 className="text-[15px] font-bold text-[#0b1c30]">
              Adresse de livraison
            </h2>
            <div>
              <label className="text-[12px] font-semibold text-[#404941] block mb-1">
                Rue
              </label>
              <input
                type="text"
                value={address.street}
                onChange={(e) => handleAddressChange('street', e.target.value)}
                placeholder="Numéro et nom de rue"
                className="w-full h-11 px-4 bg-[#f8f9ff] border border-[#c0c9be] rounded-xl text-[13px] text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#1a5c35] focus:ring-1 focus:ring-[#1a5c35] transition-all"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold text-[#404941] block mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  placeholder="Ville"
                  className="w-full h-11 px-4 bg-[#f8f9ff] border border-[#c0c9be] rounded-xl text-[13px] text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#1a5c35] focus:ring-1 focus:ring-[#1a5c35] transition-all"
                  required
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-[#404941] block mb-1">
                  Code postal
                </label>
                <input
                  type="text"
                  value={address.postalCode}
                  onChange={(e) =>
                    handleAddressChange('postalCode', e.target.value)
                  }
                  placeholder="Code postal"
                  className="w-full h-11 px-4 bg-[#f8f9ff] border border-[#c0c9be] rounded-xl text-[13px] text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#1a5c35] focus:ring-1 focus:ring-[#1a5c35] transition-all"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#404941] block mb-1">
                Pays
              </label>
              <input
                type="text"
                value={address.country}
                onChange={(e) => handleAddressChange('country', e.target.value)}
                placeholder="Pays"
                className="w-full h-11 px-4 bg-[#f8f9ff] border border-[#c0c9be] rounded-xl text-[13px] text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#1a5c35] focus:ring-1 focus:ring-[#1a5c35] transition-all"
                required
              />
            </div>
          </section>

          {/* Notes */}
          <section className="bg-white border border-[#c0c9be] rounded-xl p-4 space-y-2">
            <h2 className="text-[15px] font-bold text-[#0b1c30]">
              Note (optionnelle)
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions particulières pour le vendeur..."
              rows={3}
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#c0c9be] rounded-xl text-[13px] text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#1a5c35] focus:ring-1 focus:ring-[#1a5c35] transition-all resize-none"
            />
          </section>

          {/* Confirm Button */}
          <button
            type="submit"
            disabled={!isAddressValid || checkout.isPending || lines.length === 0}
            className="w-full py-4 bg-[#004322] text-white rounded-xl text-[15px] font-bold hover:bg-[#1a5c35] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {checkout.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Confirmation...
              </>
            ) : (
              'Confirmer la commande'
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
