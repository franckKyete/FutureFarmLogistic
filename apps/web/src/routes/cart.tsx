import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getBasketQuery,
  updateBasketLineMutation,
  removeBasketLineMutation,
} from '@/features/basket/api/basket.queries';
import { addToast } from '@/features/shared/store/toast.store';
import type { BasketLineDto } from '@futurefarm/types';

export const Route = createFileRoute('/cart')({
  beforeLoad: () => {
    requireAuth();
  },
  component: CartPage,
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

function CartLine({
  line,
  refetch,
}: {
  line: EnrichedLine;
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
  const unitPrice = line.harvest?.pricePerUnit ?? 0;
  const subtotal = unitPrice * line.quantity;
  const photoUrl = line.harvest?.photoUrls?.[0];
  const maxQty = 99;

  return (
    <div className="bg-white border border-[#c0c9be] rounded-xl p-4 flex gap-4 shadow-sm">
      {/* Thumbnail */}
      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#eff4ff]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={productName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[#707970] text-[32px]">
              image
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-bold text-[#0b1c30] truncate">
              {productName}
            </h3>
            <p className="text-[13px] font-semibold text-[#1a5c35] mt-0.5">
              {unitPrice.toLocaleString()} FCFA / {line.harvest?.unit || 'unité'}
            </p>
          </div>
          {/* Delete button */}
          <button
            onClick={() => removeLine.mutate()}
            disabled={removeLine.isPending}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-outlined text-[#D32F2F] text-[20px]">
              delete
            </span>
          </button>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (line.quantity > 1) {
                  updateQty.mutate({ quantity: line.quantity - 1 });
                }
              }}
              disabled={line.quantity <= 1 || updateQty.isPending}
              className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center hover:bg-[#dce9ff] transition-colors cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[#004322] text-[18px]">
                remove
              </span>
            </button>
            <span className="w-8 text-center text-[14px] font-bold text-[#0b1c30]">
              {line.quantity}
            </span>
            <button
              onClick={() => {
                if (line.quantity < maxQty) {
                  updateQty.mutate({ quantity: line.quantity + 1 });
                }
              }}
              disabled={line.quantity >= maxQty || updateQty.isPending}
              className="w-8 h-8 rounded-full bg-[#eff4ff] flex items-center justify-center hover:bg-[#dce9ff] transition-colors cursor-pointer disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[#004322] text-[18px]">
                add
              </span>
            </button>
          </div>
          <span className="text-[14px] font-bold text-[#0b1c30]">
            {subtotal.toLocaleString()} FCFA
          </span>
        </div>
      </div>
    </div>
  );
}

function CartPage() {
  const navigate = useNavigate();
  const { data: basket, refetch } = useQuery(getBasketQuery());

  const lines: EnrichedLine[] = (basket?.lines as EnrichedLine[]) || [];
  const totalPrice = lines.reduce((sum, line) => {
    return sum + (line.harvest?.pricePerUnit ?? 0) * line.quantity;
  }, 0);

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex justify-between items-center px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/marketplace"
            className="material-symbols-outlined text-[#004322] cursor-pointer"
          >
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322]">Panier</h1>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-4">
        {lines.length === 0 ? (
          <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">
              shopping_cart
            </span>
            <p className="text-[#404941] font-semibold mb-4">Votre panier est vide</p>
            <Link
              to="/marketplace"
              className="inline-block px-6 py-3 bg-[#004322] text-white rounded-xl text-[13px] font-bold hover:bg-[#1a5c35] transition-colors cursor-pointer"
            >
              Découvrir le marché
            </Link>
          </div>
        ) : (
          <>
            {/* Cart Lines */}
            <div className="space-y-3">
              {lines.map((line) => (
                <CartLine key={line.id} line={line} refetch={refetch} />
              ))}
            </div>

            {/* Total */}
            <div className="bg-white border border-[#c0c9be] rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-semibold text-[#0b1c30]">
                  Total
                </span>
                <span className="text-[18px] font-bold text-[#004322]">
                  {totalPrice.toLocaleString()} FCFA
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => navigate({ to: '/checkout' })}
              className="w-full py-4 bg-[#004322] text-white rounded-xl text-[15px] font-bold hover:bg-[#1a5c35] transition-colors cursor-pointer active:scale-[0.98]"
            >
              Commander
            </button>
          </>
        )}
      </main>
    </div>
  );
}
