import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuctionDetailsQuery } from '@/features/auctions/api/auctions.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/auctions/$id/auto-bid')({
  beforeLoad: () => {
    requireAuth();
  },
  component: AutoBidPage,
});

function AutoBidPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: auction, isLoading } = useQuery(getAuctionDetailsQuery(id));

  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveAutoBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maxPrice || Number(maxPrice) <= 0) {
      addToast('Veuillez saisir un prix plafond valide', 'error');
      return;
    }

    if (auction && Number(maxPrice) < auction.reservePrice) {
      addToast(`Le prix plafond doit être supérieur ou égal au prix plancher (${auction.reservePrice} CDF)`, 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      addToast(`Enchère automatique configurée à ${Number(maxPrice).toLocaleString()} CDF`, 'success');
      void navigate({ to: '/auctions/$id', params: { id } });
    }, 400);
  };

  if (isLoading || !auction) {
    return (
      <div className="bg-[#f8f9ff] min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="animate-pulse text-center space-y-2">
          <div className="h-6 w-32 bg-gray-200 rounded mx-auto" />
          <div className="h-4 w-48 bg-gray-200 rounded mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9ff] min-h-screen font-sans max-w-lg mx-auto pb-12">
      {/* Header */}
      <header className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-30 flex items-center gap-2">
        <Link to="/auctions/$id" params={{ id }} className="p-1 text-gray-600 hover:text-gray-900 rounded-lg">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-sm font-bold text-[#0b1c30]">Configuration Enchère Auto</h1>
          <p className="text-[10px] text-gray-500">Enchère #{auction.id.slice(0, 6)}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4">
        {/* Auction Price Summary */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-[#004322]">smart_toy</span>
            <h2 className="text-sm font-bold text-[#0b1c30]">Détails du lot</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-[#f8f9ff] p-3 rounded-xl">
              <p className="text-[10px] text-gray-500 font-semibold">Prix actuel</p>
              <p className="text-sm font-bold font-mono text-[#004322]">
                {auction.currentPrice.toLocaleString()} CDF
              </p>
            </div>
            <div className="bg-[#f8f9ff] p-3 rounded-xl">
              <p className="text-[10px] text-gray-500 font-semibold">Prix plancher (réserve)</p>
              <p className="text-sm font-bold font-mono text-gray-700">
                {auction.reservePrice.toLocaleString()} CDF
              </p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSaveAutoBid} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">Seuil d'achat automatique</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Dès que le prix décroissant atteint ou descend en-dessous de votre seuil, l'offre sera automatiquement validée.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Prix d'achat souhaité (CDF)
            </label>
            <input
              type="number"
              min={auction.reservePrice}
              max={auction.currentPrice}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
              placeholder={`Ex: ${Math.round((auction.currentPrice + auction.reservePrice) / 2)}`}
              className="w-full text-base font-mono font-bold border border-gray-300 rounded-xl p-3 bg-white text-gray-900 focus:ring-2 focus:ring-[#004322] focus:outline-none"
              required
            />
          </div>

          <div className="bg-[#eff4ff] p-3.5 rounded-xl text-xs text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-blue-600">info</span>
              Fonctionnement
            </p>
            <p className="text-[11px] leading-relaxed text-blue-800">
              Enchère hollandaise : Le premier acheteur dont le prix est atteint remporte la totalité du lot ({auction.quantityOnOffer} kg).
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <Link
              to="/auctions/$id"
              params={{ id }}
              className="flex-1 py-3 text-center bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 transition-colors"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !maxPrice}
              className="flex-1 py-3 bg-[#004322] text-white font-bold text-xs rounded-xl hover:bg-[#00331a] active:scale-98 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Enregistrement...' : "Activer l'auto-bid"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
