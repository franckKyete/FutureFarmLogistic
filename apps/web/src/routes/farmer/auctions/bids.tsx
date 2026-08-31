import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getMyBidsQuery } from '@/features/auctions/api/auctions.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';

export const Route = createFileRoute('/farmer/auctions/bids')({
  beforeLoad: () => {
    requireAuth();
  },
  component: MyBidsPage,
});

function MyBidsPage() {
  const { data: bids = [], isLoading, isError, refetch } = useQuery(getMyBidsQuery());

  return (
    <div className="bg-[#f8f9ff] min-h-screen font-sans max-w-lg mx-auto pb-24">
      {/* Main Content */}
      <main className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-200 animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-6 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-rose-500">error_outline</span>
            <p className="text-sm font-bold text-gray-700">Impossible de charger vos offres</p>
            <button
              onClick={() => void refetch()}
              className="text-xs bg-[#004322] text-white px-4 py-2 rounded-xl font-bold cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : bids.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 p-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-gray-400">gavel</span>
            <p className="text-sm font-bold text-gray-700">Aucune enchère placée</p>
            <p className="text-xs text-gray-500">Participez aux ventes aux enchères hollandaises en direct.</p>
            <Link
              to="/auctions"
              className="inline-block text-xs bg-[#004322] text-white px-4 py-2.5 rounded-xl font-bold mt-2"
            >
              Découvrir les enchères
            </Link>
          </div>
        ) : (
          bids.map((bid) => {
            const isAccepted = bid.status === 'ACCEPTED';
            return (
              <div
                key={bid.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gray-500">
                    Offre #{bid.id.slice(0, 6)}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      isAccepted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isAccepted ? '🏆 Remportée / Validée' : 'Annulée'}
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <div>
                    <p className="text-xs text-gray-500">Prix adjugé</p>
                    <p className="text-lg font-bold font-mono text-[#004322]">
                      {bid.priceAtBid.toLocaleString()} CDF
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Quantité</p>
                    <p className="text-sm font-bold text-gray-800">{bid.quantityWon} kg</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    Enchère #{bid.auctionId.slice(0, 6)}
                  </span>
                  <Link
                    to="/auctions/$id"
                    params={{ id: bid.auctionId }}
                    className="text-xs font-bold text-[#004322] flex items-center gap-0.5 hover:underline"
                  >
                    Voir l'enchère
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
