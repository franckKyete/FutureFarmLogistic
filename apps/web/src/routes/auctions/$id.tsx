import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getAuctionDetailsQuery,
  getMyBidsQuery,
  placeBidMutation,
  cancelBidMutation,
} from '@/features/auctions/api/auctions.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { addToast } from '@/features/shared/store/toast.store';
import { AuctionStatus, AuctionEvent } from '@futurefarm/types';

export const Route = createFileRoute('/auctions/$id')({
  component: AuctionDetailPage,
});

function AuctionDetailPage() {
  const { id } = Route.useParams();
  const { isAuthenticated } = useAuth();

  // Queries
  const { data: auction, refetch: refetchAuction } = useQuery(getAuctionDetailsQuery(id));
  const { data: myBids } = useQuery({ ...getMyBidsQuery(), enabled: isAuthenticated });

  // WebSocket live state
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [auctionEnded, setAuctionEnded] = useState(false);

  // Find user's existing bid on this auction
  const existingBid = myBids?.find((b) => b.auctionId === id);

  // Cancel confirmation state
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Mutations
  const placeBid = useMutation({
    ...placeBidMutation(),
    onSuccess: () => {
      addToast('Enchère placée avec succès !', 'success');
      void refetchAuction();
    },
    onError: () => {
      addToast("Erreur lors du placement de l'enchère", 'error');
    },
  });

  const cancelBid = useMutation({
    ...cancelBidMutation(),
    onSuccess: () => {
      addToast('Enchère annulée.', 'success');
      void refetchAuction();
    },
    onError: () => {
      addToast("Erreur lors de l'annulation", 'error');
    },
  });

  // WebSocket connection for live price updates
  useEffect(() => {
    if (!id) return;
    const baseUrl = import.meta.env['VITE_API_BASE_URL']
      ? (import.meta.env['VITE_API_BASE_URL'] as string).replace('https://', 'wss://').replace('http://', 'ws://').replace('/v1', '')
      : window.location.origin;
    const wsUrl = `${baseUrl}/auctions/${id}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === AuctionEvent.PRICE_TICK) {
          setCurrentPrice(msg.currentPrice);
        }
        if (msg.event === AuctionEvent.AUCTION_SOLD) {
          setAuctionEnded(true);
          setCurrentPrice(msg.currentPrice ?? msg.priceAtBid);
          addToast('Cette enchère a été remportée !', 'info');
        }
        if (msg.event === AuctionEvent.AUCTION_EXPIRED) {
          setAuctionEnded(true);
          addToast("L'enchère a expiré.", 'info');
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => setWsConnected(false);

    return () => ws.close();
  }, [id]);

  // Reset state on auction change
  useEffect(() => {
    setCurrentPrice(null);
    setWsConnected(false);
    setAuctionEnded(false);
  }, [id]);

  if (!auction) {
    return (
      <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex items-center justify-center font-sans">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">gavel</span>
          <p className="text-[#404941]">Chargement...</p>
        </div>
      </div>
    );
  }

  const displayPrice = currentPrice ?? auction.currentPrice;
  const isActive = auction.status === AuctionStatus.ACTIVE && !auctionEnded;
  const priceDropped = currentPrice !== null && currentPrice < auction.currentPrice;
  const progressPercent = useMemo(() => {
    const startMs = new Date(auction.startAt).getTime();
    const endMs = new Date(auction.endAt).getTime();
    const totalMs = endMs - startMs;
    if (totalMs <= 0) return 0;
    const elapsed = Date.now() - startMs;
    return Math.min(100, Math.max(0, Math.round((elapsed / totalMs) * 100)));
  }, [auction.startAt, auction.endAt]);

  const getTimeRemaining = (endAt: string): string => {
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'Terminée';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `~${days} jours`;
    }
    return `${hours}h ${minutes}min`;
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-32 font-sans">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex items-center justify-between px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            to="/auctions"
            className="material-symbols-outlined text-[#004322] cursor-pointer"
          >
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322]">Détail enchère</h1>
        </div>
        {wsConnected && (
          <div className="flex items-center gap-1 text-[#1a5c35]">
            <span className="w-2 h-2 rounded-full bg-[#1a5c35] animate-pulse"></span>
            <span className="text-[10px] font-semibold">LIVE</span>
          </div>
        )}
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto">
        {/* Price Section */}
        <section className="bg-white border border-[#c0c9be] rounded-2xl p-6 mb-4 text-center">
          {/* Progress ring (simplified bar) */}
          {isActive && (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-[#707970] mb-1">
                <span>Début</span>
                <span>Fin</span>
              </div>
              <div className="w-full h-2 bg-[#eff4ff] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1a5c35] rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-[12px] text-[#707970] font-semibold uppercase tracking-wider mb-1">
            Prix actuel
          </p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-[36px] font-bold text-[#0b1c30]">
              {displayPrice.toLocaleString()}
              <span className="text-[16px] text-[#707970] ml-1">FCFA</span>
            </p>
            {priceDropped && (
              <span className="material-symbols-outlined text-[#1a5c35] text-[24px] animate-bounce">
                trending_down
              </span>
            )}
          </div>
          {priceDropped && (
            <p className="text-[#1a5c35] text-[12px] font-semibold mt-1">
              Prix mis à jour en temps réel
            </p>
          )}

          {/* Time remaining */}
          {isActive && (
            <div className="mt-4 bg-[#fff8e1] border border-[#ffa93d]/30 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#885200]">
                <span className="material-symbols-outlined text-[20px]">timer</span>
                <span className="text-[16px] font-bold">{getTimeRemaining(auction.endAt)}</span>
              </div>
              <span className="text-[#885200] text-[11px] font-semibold">Temps restant</span>
            </div>
          )}
        </section>

        {/* Auction detail cards */}
        <section className="bg-white border border-[#c0c9be] rounded-2xl p-4 mb-4">
          <h3 className="text-[14px] font-semibold text-[#0b1c30] mb-3">Informations</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-semibold tracking-wider">Statut</p>
              <p className="text-[14px] font-semibold mt-0.5">
                {auctionEnded
                  ? 'Terminée'
                  : auction.status === AuctionStatus.ACTIVE
                    ? 'En cours'
                    : auction.status === AuctionStatus.SCHEDULED
                      ? 'À venir'
                      : auction.status === AuctionStatus.SOLD
                        ? 'Vendue'
                        : auction.status === AuctionStatus.EXPIRED
                          ? 'Expirée'
                          : auction.status === AuctionStatus.CANCELLED
                            ? 'Annulée'
                            : auction.status}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-semibold tracking-wider">Quantité</p>
              <p className="text-[14px] font-semibold mt-0.5">{auction.quantityOnOffer} kg</p>
            </div>
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-semibold tracking-wider">Prix de départ</p>
              <p className="text-[14px] font-semibold mt-0.5">{auction.startingPrice.toLocaleString()} FCFA</p>
            </div>
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-semibold tracking-wider">Prix de réserve</p>
              <p className="text-[14px] font-semibold mt-0.5">{auction.reservePrice.toLocaleString()} FCFA</p>
            </div>
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-semibold tracking-wider">Baisse par intervalle</p>
              <p className="text-[14px] font-semibold mt-0.5">
                {auction.priceDecrementAmount.toLocaleString()} FCFA / {auction.priceDecrementIntervalMinutes}min
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#707970] uppercase font-semibold tracking-wider">Début</p>
              <p className="text-[14px] font-semibold mt-0.5">
                {new Date(auction.startAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </section>

        {/* Status-specific message */}
        {auction.status === AuctionStatus.SOLD && (
          <section className="bg-[#e8f5e9] border border-[#1a5c35]/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#1a5c35] text-[24px]">check_circle</span>
            <div>
              <p className="text-[14px] font-bold text-[#1a5c35]">Enchère remportée</p>
              <p className="text-[12px] text-[#404941]">Cette enchère a déjà été conclue.</p>
            </div>
          </section>
        )}

        {auction.status === AuctionStatus.EXPIRED && (
          <section className="bg-[#FFF8E1] border border-[#ffa93d]/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#885200] text-[24px]">schedule</span>
            <div>
              <p className="text-[14px] font-bold text-[#885200]">Enchère expirée</p>
              <p className="text-[12px] text-[#404941]">Le délai est écoulé pour cette enchère.</p>
            </div>
          </section>
        )}
      </main>

      {/* Bottom action bar */}
      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-[#c0c9be] z-50 px-4 py-4">
        {isActive && isAuthenticated ? (
          <div className="flex gap-3">
            <button
              onClick={() => placeBid.mutate(id)}
              disabled={placeBid.isPending || !isActive}
              className="flex-1 py-3.5 bg-[#004322] text-white rounded-xl text-[14px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placeBid.isPending ? (
                'En cours...'
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                  Placer une enchère
                </>
              )}
            </button>
            {existingBid && !confirmingCancel && (
              <button
                onClick={() => setConfirmingCancel(true)}
                disabled={cancelBid.isPending}
                className="px-4 py-3.5 border border-[#c0c9be] rounded-xl text-[14px] font-semibold text-[#404941] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                Annuler
              </button>
            )}
            {existingBid && confirmingCancel && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    cancelBid.mutate(id);
                    setConfirmingCancel(false);
                  }}
                  disabled={cancelBid.isPending}
                  className="flex-1 py-3.5 bg-[#D32F2F] text-white rounded-xl text-[14px] font-bold active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {cancelBid.isPending ? '...' : 'Confirmer'}
                </button>
                <button
                  onClick={() => setConfirmingCancel(false)}
                  className="px-4 py-3.5 border border-[#c0c9be] rounded-xl text-[14px] font-semibold text-[#404941] active:scale-[0.98] transition-all cursor-pointer"
                >
                  Retour
                </button>
              </div>
            )}
          </div>
        ) : isActive && !isAuthenticated ? (
          <Link
            to="/auth/login"
            className="w-full block py-3.5 bg-[#004322] text-white rounded-xl text-[14px] font-bold active:scale-[0.98] transition-all text-center cursor-pointer shadow-sm"
          >
            Connectez-vous pour enchérir
          </Link>
        ) : (
          <div className="text-center text-[#707970] text-[12px] font-semibold">
            {auctionEnded || auction.status === AuctionStatus.SOLD || auction.status === AuctionStatus.EXPIRED
              ? 'Cette enchère est terminée'
              : auction.status === AuctionStatus.CANCELLED
                ? 'Enchère annulée'
                : "L'enchère n'est pas encore active"}
          </div>
        )}
      </footer>
    </div>
  );
}
