import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuctionsQuery } from '@/features/auctions/api/auctions.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuctionStatus } from '@futurefarm/types';

export const Route = createFileRoute('/auctions/story')({
  component: AuctionsStoryPage,
});

function AuctionsStoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  const { data: paginatedData } = useQuery(getAuctionsQuery({ status: AuctionStatus.ACTIVE }));
  const auctions = paginatedData?.data || [];

  const currentAuction = auctions[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < auctions.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, auctions.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // Auto-advance timer — 5 seconds per story
  useEffect(() => {
    if (auctions.length <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [currentIndex, handleNext, auctions.length]);

  // Touch handlers for vertical swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    touchEndY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchEndY.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartY.current - touchEndY.current;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  }, [handleNext, handlePrev]);

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

  if (auctions.length === 0) {
    return (
      <div className="bg-[#0b1c30] text-white min-h-screen flex flex-col items-center justify-center px-4 font-sans">
        <span className="material-symbols-outlined text-[64px] text-[#707970] mb-4 block">gavel</span>
        <h2 className="text-[20px] font-semibold mb-2">Aucune enchère active</h2>
        <p className="text-[#c0c9be] text-[14px] mb-6 text-center">Revenez plus tard pour découvrir les nouvelles enchères.</p>
        <Link
          to="/auctions"
          className="px-6 py-3 bg-white text-[#0b1c30] rounded-xl text-[14px] font-semibold active:scale-95 transition-all cursor-pointer"
        >
          Voir la liste
        </Link>
      </div>
    );
  }

  if (!currentAuction) return null;

  return (
    <div
      className="bg-[#0b1c30] text-white min-h-screen font-sans flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex gap-1 px-2 pt-3 pb-2 max-w-[480px] mx-auto">
        {auctions.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              idx <= currentIndex ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Top bar */}
      <header className="relative z-50 flex items-center justify-between px-4 pt-8 pb-2 max-w-[480px] mx-auto w-full">
        <Link
          to="/auctions"
          className="material-symbols-outlined text-white p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
        >
          close
        </Link>
        <span className="text-[12px] text-white/70 font-semibold">
          {currentIndex + 1} / {auctions.length}
        </span>
      </header>

      {/* Main story content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 max-w-[480px] mx-auto w-full">
        <div className="w-full flex flex-col items-center gap-6 animate-fadeIn">
          {/* Auction visual */}
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#eff4ff] to-[#dce9ff] flex items-center justify-center shadow-2xl">
            <span className="material-symbols-outlined text-[72px] text-[#004322] opacity-40">gavel</span>
          </div>

          {/* Price */}
          <div className="text-center">
            <p className="text-[14px] text-[#c0c9be] font-semibold uppercase tracking-wider mb-1">
              Prix actuel
            </p>
            <p className="text-[40px] font-bold text-white">
              {currentAuction.currentPrice.toLocaleString()}
              <span className="text-[18px] text-[#c0c9be] ml-1">FCFA</span>
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="material-symbols-outlined text-[#ffa93d] text-[18px]">trending_down</span>
              <span className="text-[#ffa93d] text-[14px] font-semibold">
                Départ: {currentAuction.startingPrice.toLocaleString()} FCFA
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 w-full flex justify-between items-center">
            <div className="text-center">
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Quantité</p>
              <p className="text-[16px] font-bold">{currentAuction.quantityOnOffer} kg</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Temps restant</p>
              <p className="text-[16px] font-bold">{getTimeRemaining(currentAuction.endAt)}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-[10px] text-white/60 uppercase tracking-wider">Prix de réserve</p>
              <p className="text-[16px] font-bold">{currentAuction.reservePrice.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom action */}
      <footer className="px-4 pb-8 max-w-[480px] mx-auto w-full">
        {isAuthenticated ? (
          <button
            onClick={() => void navigate({ to: '/auctions/$id', params: { id: currentAuction.id } })}
            className="w-full py-4 bg-white text-[#0b1c30] rounded-2xl text-[16px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <span className="material-symbols-outlined">gavel</span>
            Placer une enchère
          </button>
        ) : (
          <Link
            to="/auth/login"
            className="w-full py-4 bg-white text-[#0b1c30] rounded-2xl text-[16px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <span className="material-symbols-outlined">login</span>
            Se connecter
          </Link>
        )}

        {/* Swipe hint */}
        <p className="text-center text-[12px] text-white/40 mt-4">
          Glissez vers le haut ou le bas pour naviguer
        </p>
      </footer>
    </div>
  );
}
