import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuctionsQuery } from '@/features/auctions/api/auctions.queries';
import { AuctionStatus } from '@futurefarm/types';

export interface StorySearchParams {
  producerId?: string;
  auctionId?: string;
}

export const Route = createFileRoute('/auctions/story')({
  validateSearch: (search: Record<string, unknown>): StorySearchParams => {
    const res: StorySearchParams = {};
    if (typeof search['producerId'] === 'string' && search['producerId']) {
      res.producerId = search['producerId'];
    }
    if (typeof search['auctionId'] === 'string' && search['auctionId']) {
      res.auctionId = search['auctionId'];
    }
    return res;
  },
  component: AuctionsStoryPage,
});

function StoryBackgroundPlaceholder({ productName }: { productName: string }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#003319] via-[#0b1c30] to-[#040d16] flex flex-col items-center justify-center text-white/20">
      <Icon name="agriculture" className="text-[120px]" />
      <p className="text-[20px] font-bold text-white/30 mt-2">{productName}</p>
    </div>
  );
}

function StoryProducerAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const initial = (name || 'P').trim().charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-10 h-10 rounded-full border-2 border-white object-cover shadow-md"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-full border-2 border-white bg-[#004322] text-white flex items-center justify-center font-bold text-[14px] shadow-md">
      {initial}
    </div>
  );
}

interface FarmerGroup {
  farmerId: string;
  farmerName: string;
  farmerAvatar: string | null;
  auctions: any[];
}

function AuctionsStoryPage() {
  const navigate = useNavigate();
  const { producerId, auctionId } = Route.useSearch();
  const [currentFarmerIndex, setCurrentFarmerIndex] = useState(0);
  const [currentAuctionIndex, setCurrentAuctionIndex] = useState(0);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  const { data: paginatedData } = useQuery(
    getAuctionsQuery({ status: AuctionStatus.ACTIVE }),
  );
  const allAuctions = paginatedData?.data || [];

  // Group active auctions by farmer
  const farmerGroups = useMemo(() => {
    const active = allAuctions.filter((a) => a.status === AuctionStatus.ACTIVE);
    const map = new Map<string, FarmerGroup>();

    active.forEach((a: any) => {
      const farmerId =
        a.farmerProfile?.id || a.farmerProfileId || 'unknown-farmer';
      const name =
        a.farmerProfile?.companyName ||
        a.farmerProfile?.farmName ||
        a.farmerProfile?.user?.name ||
        'Producteur';
      const avatar =
        a.farmerProfile?.avatarUrl ||
        a.farmerProfile?.user?.avatarUrl ||
        null;

      if (!map.has(farmerId)) {
        map.set(farmerId, {
          farmerId,
          farmerName: name,
          farmerAvatar: avatar,
          auctions: [],
        });
      }
      map.get(farmerId)!.auctions.push(a);
    });

    return Array.from(map.values());
  }, [allAuctions]);

  // Jump to specific producer's or auction's story if provided in search params
  useEffect(() => {
    if (farmerGroups.length === 0) return;
    if (producerId) {
      const gIdx = farmerGroups.findIndex((g) => g.farmerId === producerId);
      if (gIdx !== -1) {
        setCurrentFarmerIndex(gIdx);
        setCurrentAuctionIndex(0);
      }
    } else if (auctionId) {
      for (let gIdx = 0; gIdx < farmerGroups.length; gIdx++) {
        const group = farmerGroups[gIdx];
        if (!group) continue;
        const aIdx = group.auctions.findIndex((a) => a.id === auctionId);
        if (aIdx !== -1) {
          setCurrentFarmerIndex(gIdx);
          setCurrentAuctionIndex(aIdx);
          break;
        }
      }
    }
  }, [producerId, auctionId, farmerGroups]);

  const currentFarmerGroup =
    farmerGroups[currentFarmerIndex] || farmerGroups[0];
  const currentAuctions = currentFarmerGroup?.auctions || [];
  const currentAuction =
    currentAuctions[currentAuctionIndex] || currentAuctions[0];

  const handleNext = useCallback(() => {
    if (!currentFarmerGroup) return;
    if (currentAuctionIndex < currentFarmerGroup.auctions.length - 1) {
      // Advance to next auction of this farmer
      setCurrentAuctionIndex((prev) => prev + 1);
    } else if (currentFarmerIndex < farmerGroups.length - 1) {
      // Advance to first auction of next farmer
      setCurrentFarmerIndex((prev) => prev + 1);
      setCurrentAuctionIndex(0);
    } else {
      // Finished all farmers' stories -> navigate back to auctions list
      void navigate({ to: '/auctions' });
    }
  }, [
    currentFarmerIndex,
    currentAuctionIndex,
    currentFarmerGroup,
    farmerGroups.length,
    navigate,
  ]);

  const handlePrev = useCallback(() => {
    if (!currentFarmerGroup) return;
    if (currentAuctionIndex > 0) {
      // Go to previous auction of this farmer
      setCurrentAuctionIndex((prev) => prev - 1);
    } else if (currentFarmerIndex > 0) {
      // Go to last auction of previous farmer
      const prevGroup = farmerGroups[currentFarmerIndex - 1];
      setCurrentFarmerIndex((prev) => prev - 1);
      setCurrentAuctionIndex(
        prevGroup ? prevGroup.auctions.length - 1 : 0,
      );
    }
  }, [currentFarmerIndex, currentAuctionIndex, currentFarmerGroup, farmerGroups]);

  // Auto-advance timer — 6 seconds per story
  useEffect(() => {
    if (!currentFarmerGroup || currentFarmerGroup.auctions.length === 0) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(timer);
  }, [currentFarmerIndex, currentAuctionIndex, handleNext, currentFarmerGroup]);

  // Touch handlers for vertical swipe to close
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
    const threshold = 60;
    if (diff < -threshold) {
      // Swiped down -> close story
      void navigate({ to: '/auctions' });
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  }, [navigate]);

  const formatTimeRemaining = (endAt?: string): string => {
    if (!endAt) return 'En cours';
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'Terminée';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  if (farmerGroups.length === 0) {
    return (
      <div className="bg-[#0b1c30] text-white min-h-screen flex flex-col items-center justify-center px-4 font-sans">
        <Icon name="gavel" className="text-[64px] text-[#707970] mb-4 block" />
        <h2 className="text-[20px] font-semibold mb-2">Aucune enchère en cours</h2>
        <p className="text-[#c0c9be] text-[14px] mb-6 text-center">
          Revenez plus tard pour découvrir les nouvelles enchères en direct.
        </p>
        <Link
          to="/auctions"
          className="px-6 py-3 bg-white text-[#0b1c30] rounded-xl text-[14px] font-bold active:scale-95 transition-all cursor-pointer"
        >
          Voir la liste
        </Link>
      </div>
    );
  }

  if (!currentAuction || !currentFarmerGroup) return null;

  const productName =
    (currentAuction as any).harvest?.product?.name ||
    (currentAuction as any).harvest?.variety ||
    'Lot agricole';
  const producerName = currentFarmerGroup.farmerName;
  const producerAvatar = currentFarmerGroup.farmerAvatar;
  const currency = currentAuction.currency || 'CDF';
  const harvestImage =
    (currentAuction as any).harvest?.photoUrls?.[0] ||
    (currentAuction as any).harvest?.images?.[0];
  const qualityScore = (currentAuction as any).harvest?.qualityScore;
  const qualityGrade = (currentAuction as any).harvest?.qualityGrade;

  return (
    <div
      className="relative bg-black text-white min-h-screen font-sans flex flex-col justify-between overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image or Clean Dark Placeholder */}
      <div className="absolute inset-0 z-0">
        {harvestImage ? (
          <img
            src={harvestImage}
            alt={productName}
            className="w-full h-full object-cover brightness-[0.75] contrast-[1.05]"
          />
        ) : (
          <StoryBackgroundPlaceholder productName={productName} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/95" />
      </div>

      {/* Left / Right Full-Screen Tap & Click Navigation Zones */}
      <div className="absolute inset-0 z-20 flex pointer-events-auto">
        <div
          onClick={handlePrev}
          className="w-1/2 h-full cursor-pointer select-none"
          title="Précédent"
          aria-label="Précédent"
        />
        <div
          onClick={handleNext}
          className="w-1/2 h-full cursor-pointer select-none"
          title="Suivant"
          aria-label="Suivant"
        />
      </div>

      {/* Top Header Section */}
      <div className="relative z-30 pointer-events-none max-w-[480px] mx-auto w-full">
        {/* Progress Bars at top — Specific to the current farmer */}
        <div className="flex gap-1.5 px-3 pt-3 pb-2 w-full">
          {currentAuctions.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                idx <= currentAuctionIndex ? 'bg-white shadow-xs' : 'bg-white/30'
              }`}
            />
          ))}
        </div>

        {/* Story Top Bar with Producer Info & Close Button */}
        <header className="flex items-center justify-between px-4 pt-1 w-full">
          <div className="flex items-center gap-3 pointer-events-auto">
            <StoryProducerAvatar
              name={producerName}
              avatarUrl={producerAvatar}
            />
            <div>
              <h4 className="text-[14px] font-bold text-white leading-tight">
                {producerName}
              </h4>
              <p className="text-[11px] text-white/70">
                {currentAuctions.length > 1
                  ? `Enchère ${currentAuctionIndex + 1} sur ${currentAuctions.length}`
                  : 'Enchère en direct'}
              </p>
            </div>
          </div>
          <Link
            to="/auctions"
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer flex items-center justify-center pointer-events-auto shadow-md"
            aria-label="Fermer"
          >
            <Icon name="close" className="text-[20px]" />
          </Link>
        </header>
      </div>

      {/* Spacer for center */}
      <div className="flex-1" />

      {/* Story Bottom Content & Dutch Price Box */}
      <div className="relative z-30 px-4 pb-6 max-w-[480px] mx-auto w-full flex flex-col gap-4 pointer-events-none">
        {/* Badges: LIVE + Countdown */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {currentAuction.status === AuctionStatus.ACTIVE ? (
            <span className="bg-[#ff9800] text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              LIVE
            </span>
          ) : (
            <span className="bg-[#ffa93d] text-[#0b1c30] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-sm">
              À venir
            </span>
          )}
          <span className="bg-black/50 backdrop-blur-md text-white/90 px-3 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border border-white/10">
            <Icon name="alarm" className="text-[13px]" />
            Se termine dans {formatTimeRemaining(currentAuction.endAt)}
          </span>
        </div>

        {/* Product Title & Stock Info */}
        <div className="pointer-events-auto">
          <h2 className="text-[28px] font-black text-white leading-tight drop-shadow-md">
            {productName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[13px] text-white/80 font-medium">
              {currentAuction.quantityOnOffer} kg disponibles
            </span>
            {qualityScore ? (
              <>
                <span className="text-white/40">•</span>
                <span className="bg-[#1a5c35]/80 text-[#81c784] border border-[#81c784]/30 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                  <Icon name="verified" className="text-[12px]" />
                  IA : {qualityScore}%
                </span>
              </>
            ) : qualityGrade ? (
              <>
                <span className="text-white/40">•</span>
                <span className="bg-[#1a5c35]/80 text-[#81c784] border border-[#81c784]/30 px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                  Qualité {qualityGrade}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Glassmorphism Dutch Price Decay Box with Step Chart */}
        <div className="bg-black/50 backdrop-blur-md border border-white/15 rounded-2xl p-4 flex items-center justify-between shadow-xl pointer-events-auto">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
              PRIX ACTUEL
            </p>
            <p className="text-[26px] font-black text-white mt-0.5">
              {currentAuction.currentPrice.toLocaleString()}{' '}
              <span className="text-[14px] font-normal text-white/70">
                {currency}/kg
              </span>
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-white/70 mt-1">
              <Icon name="gavel" className="text-[13px]" />
              <span>
                Départ : {currentAuction.startingPrice.toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Dutch Price Step Chart Visual SVG */}
          <div className="w-28 h-12 flex items-center justify-center">
            <svg
              viewBox="0 0 100 40"
              className="w-full h-full overflow-visible"
            >
              {/* Step decay path */}
              <path
                d="M 5,5 L 25,5 L 25,15 L 50,15 L 50,25 L 75,25 L 75,35 L 95,35"
                fill="none"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Target glowing dot */}
              <circle
                cx="95"
                cy="35"
                r="4"
                fill="#ffa93d"
                className="animate-ping"
              />
              <circle cx="95" cy="35" r="3.5" fill="#ffa93d" />
            </svg>
          </div>
        </div>

        {/* Action Button: Voir plus */}
        <button
          type="button"
          onClick={() =>
            void navigate({
              to: '/auctions/$id',
              params: { id: currentAuction.id },
            })
          }
          className="w-full py-4 bg-[#004322] hover:bg-[#003319] text-white rounded-2xl text-[16px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer pointer-events-auto"
        >
          <span>Voir plus</span>
          <Icon name="arrow_forward" className="text-[20px]" />
        </button>

        {/* Swipe hint */}
        <div className="flex flex-col items-center gap-0.5 text-white/50 text-[10px] font-semibold tracking-wider uppercase">
          <Icon name="keyboard_arrow_down" className="text-[14px] animate-bounce" />
          <span>GLISSER POUR FERMER</span>
        </div>
      </div>
    </div>
  );
}

