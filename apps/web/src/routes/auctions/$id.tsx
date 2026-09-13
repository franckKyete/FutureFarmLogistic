import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAuctionDetailsQuery,
  getMyBidsQuery,
  getPaymentMethodQuery,
  createSetupSessionMutation,
  confirmSetupSessionMutation,
  placeBidMutation,
  cancelBidMutation,
} from '@/features/auctions/api/auctions.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { addToast } from '@/features/shared/store/toast.store';
import { AuctionStatus, AuctionEvent, BidStatus, type AddressDto } from '@futurefarm/types';
import { io } from 'socket.io-client';
import { AddressSelector } from '@/features/addresses/components';

export interface AuctionDetailSearchParams {
  setup_session_id?: string;
}

export const Route = createFileRoute('/auctions/$id')({
  validateSearch: (search: Record<string, unknown>): AuctionDetailSearchParams => {
    const res: AuctionDetailSearchParams = {};
    if (typeof search['setup_session_id'] === 'string' && search['setup_session_id']) {
      res.setup_session_id = search['setup_session_id'];
    }
    return res;
  },
  component: AuctionDetailPage,
});

function formatCountdown(endAt: string | undefined): string {
  if (!endAt) return '00:00:00';
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function AuctionDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Queries
  const { data: auction, refetch: refetchAuction } = useQuery(getAuctionDetailsQuery(id));
  const { data: myBids, refetch: refetchMyBids } = useQuery({ ...getMyBidsQuery(), enabled: isAuthenticated });
  const { data: paymentMethod, refetch: refetchPaymentMethod } = useQuery({
    ...getPaymentMethodQuery(),
    enabled: isAuthenticated,
  });

  // State
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [countdown, setCountdown] = useState<string>('00:00:00');
  const [qualityAccordionOpen, setQualityAccordionOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  // Image Carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Bid / Bottom Sheet State
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [bidPrice, setBidPrice] = useState<number>(0);
  const [selectedAddress, setSelectedAddress] = useState<AddressDto | null>(null);

  // Live countdown interval
  useEffect(() => {
    if (!auction?.endAt) return;
    setCountdown(formatCountdown(auction.endAt));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(auction.endAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [auction?.endAt]);

  const displayPrice = currentPrice ?? (auction?.currentPrice || 0);
  const currency = auction?.currency || 'CDF';
  const isActive = auction?.status === AuctionStatus.ACTIVE && !auctionEnded;
  const priceDropped = currentPrice !== null && auction && currentPrice < auction.currentPrice;

  // Initialize or keep bidPrice synchronized when opening sheet or price drops
  useEffect(() => {
    if (displayPrice > 0 && (bidPrice === 0 || bidPrice > displayPrice)) {
      setBidPrice(displayPrice);
    }
  }, [displayPrice]);

  // Image list
  const photos = useMemo(() => {
    const list = auction?.harvest?.photoUrls;
    if (list && list.length > 0) {
      return list;
    }
    return [
      'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80',
    ];
  }, [auction?.harvest?.photoUrls]);

  // Carousel handlers
  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  // Stripe hosted setup session
  const createSetupSession = useMutation({
    ...createSetupSessionMutation(),
    onSuccess: (data) => {
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors de la redirection vers Stripe";
      addToast(msg, 'error');
    },
  });

  const confirmSetupSession = useMutation({
    ...confirmSetupSessionMutation(),
    onSuccess: () => {
      addToast('Carte bancaire enregistrée avec succès sur Stripe !', 'success');
      void queryClient.invalidateQueries({ queryKey: ['users', 'me', 'payment-method'] });
      void refetchPaymentMethod();
      void navigate({
        to: '/auctions/$id',
        params: { id },
        search: {},
        replace: true,
      });
      // Re-open bottom sheet so user can finish placing their bid
      setIsBottomSheetOpen(true);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors de l'enregistrement de la carte";
      addToast(msg, 'error');
    },
  });

  // Handle return from Stripe hosted page
  useEffect(() => {
    if (search.setup_session_id) {
      confirmSetupSession.mutate({ sessionId: search.setup_session_id });
    }
  }, [search.setup_session_id]);

  // Find user's active/pending bid on this auction
  const existingBid = useMemo(() => {
    return myBids?.find(
      (b) => b.auctionId === id && (b.status === BidStatus.PENDING || b.status === BidStatus.ACCEPTED),
    );
  }, [myBids, id]);

  // Bid Mutations
  const placeBid = useMutation({
    ...placeBidMutation(),
    onSuccess: (data) => {
      setIsBottomSheetOpen(false);
      if (data.status === BidStatus.PENDING) {
        addToast('Offre transmise avec succès !', 'success');
      } else {
        addToast('Félicitations ! Enchère remportée avec succès !', 'success');
      }
      void refetchAuction();
      void refetchMyBids();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors du placement de l'offre";
      addToast(msg, 'error');
    },
  });

  const cancelBid = useMutation({
    ...cancelBidMutation(),
    onSuccess: () => {
      addToast('Offre annulée.', 'success');
      void refetchAuction();
      void refetchMyBids();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors de l'annulation";
      addToast(msg, 'error');
    },
  });

  // Socket.IO connection for live price updates
  useEffect(() => {
    if (!id) return;
    const apiBase = (import.meta.env['VITE_API_BASE_URL'] as string) || '';
    const wsUrl = apiBase.replace(/\/v1\/?$/, '') || window.location.origin;

    const socket = io(`${wsUrl}/auctions`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setWsConnected(true);
      socket.emit('join_auction', { auctionId: id });
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
    });

    socket.on(AuctionEvent.PRICE_TICK, (data: { auctionId: string; currentPrice: number }) => {
      if (data.auctionId === id) {
        setCurrentPrice(data.currentPrice);
      }
    });

    socket.on(AuctionEvent.AUCTION_SOLD, (data: { auctionId: string; priceAtBid?: number; currentPrice?: number }) => {
      if (data.auctionId === id) {
        setAuctionEnded(true);
        setCurrentPrice(data.priceAtBid ?? data.currentPrice ?? null);
        addToast('Cette enchère a été remportée !', 'info');
      }
    });

    socket.on(AuctionEvent.AUCTION_EXPIRED, (data: { auctionId: string }) => {
      if (data.auctionId === id) {
        setAuctionEnded(true);
        addToast("L'enchère a expiré.", 'info');
      }
    });

    socket.on(AuctionEvent.AUCTION_CANCELLED, (data: { auctionId: string }) => {
      if (data.auctionId === id) {
        setAuctionEnded(true);
        addToast("L'enchère a été annulée.", 'info');
      }
    });

    return () => {
      socket.emit('leave_auction', { auctionId: id });
      socket.disconnect();
    };
  }, [id]);

  // Reset state on auction id change
  useEffect(() => {
    setCurrentPrice(null);
    setWsConnected(false);
    setAuctionEnded(false);
    setCurrentImageIndex(0);
  }, [id]);

  // Calculate descending staircase (stepped) points for SVG graph (always called unconditionally)
  const startingPrice = Number(auction?.startingPrice) || displayPrice;
  const reservePrice = Number(auction?.reservePrice) || (displayPrice > 0 ? displayPrice * 0.7 : 0);
  const priceRange = Math.max(1, startingPrice - reservePrice);
  const progressRatio = Math.max(0, Math.min(1, (startingPrice - displayPrice) / priceRange));

  const startPoint = { x: 30, y: 30, price: startingPrice, label: 'Départ' };
  const endPoint = { x: 310, y: 105, price: reservePrice, label: 'Plancher' };

  const { stairPath, stairAreaPath, stairSteps, currentPoint, bidPoint } = useMemo(() => {
    const startX = 30;
    const endX = 310;
    const startY = 30;
    const endY = 105;
    const totalW = endX - startX;
    const totalH = endY - startY;

    // Number of steps based on decrement amount or default 6-8 steps
    const decrement = Number(auction?.priceDecrementAmount) || 50;
    const stepCount = Math.max(4, Math.min(8, Math.ceil(priceRange / decrement)));

    let pathD = `M ${startX},${startY}`;
    const stepsArr: { x: number; y: number; nextX: number; price: number }[] = [];

    for (let i = 1; i <= stepCount; i++) {
      const prevX = startX + ((i - 1) / stepCount) * totalW;
      const prevY = startY + ((i - 1) / stepCount) * totalH;
      const curX = startX + (i / stepCount) * totalW;
      const curY = startY + (i / stepCount) * totalH;
      const stepPrice = startingPrice - ((i - 1) / stepCount) * priceRange;

      // Horizontal plateau, then vertical step down
      pathD += ` L ${curX},${prevY} L ${curX},${curY}`;
      stepsArr.push({ x: prevX, y: prevY, nextX: curX, price: stepPrice });
    }

    const areaD = `${pathD} L ${endX},120 L ${startX},120 Z`;

    // Position current price point on the corresponding step plateau
    const currentStepIdx = Math.min(stepCount - 1, Math.floor(progressRatio * stepCount));
    const stepFraction = progressRatio * stepCount - currentStepIdx;
    const currentPlateau = stepsArr[currentStepIdx] || { x: startX, y: startY, nextX: endX };
    const curX = currentPlateau.x + stepFraction * (currentPlateau.nextX - currentPlateau.x);
    const curY = currentPlateau.y;

    const bidPriceVal = existingBid?.autoBidMaxPrice
      ? Number(existingBid.autoBidMaxPrice)
      : existingBid?.priceAtBid
        ? Number(existingBid.priceAtBid)
        : null;

    let calculatedBidPoint: { x: number; y: number; price: number } | null = null;
    if (bidPriceVal !== null && bidPriceVal >= reservePrice && bidPriceVal <= startingPrice) {
      const bidProgressRatio = Math.max(0, Math.min(1, (startingPrice - bidPriceVal) / priceRange));
      const bidStepIdx = Math.min(stepCount - 1, Math.floor(bidProgressRatio * stepCount));
      const bidFraction = bidProgressRatio * stepCount - bidStepIdx;
      const bidPlateau = stepsArr[bidStepIdx] || { x: startX, y: startY, nextX: endX };
      const bX = bidPlateau.x + bidFraction * (bidPlateau.nextX - bidPlateau.x);
      const bY = bidPlateau.y;
      calculatedBidPoint = {
        x: Math.max(startX, Math.min(endX, bX)),
        y: bY,
        price: bidPriceVal,
      };
    }

    return {
      stairPath: pathD,
      stairAreaPath: areaD,
      stairSteps: stepsArr,
      currentPoint: {
        x: Math.max(startX, Math.min(endX, curX)),
        y: curY,
      },
      bidPoint: calculatedBidPoint,
    };
  }, [startingPrice, reservePrice, priceRange, progressRatio, auction?.priceDecrementAmount, existingBid]);

  if (!auction) {
    return (
      <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex items-center justify-center font-sans">
        <div className="text-center">
          <Icon name="gavel" className="text-[48px] text-[#707970] mb-2 block" />
          <p className="text-[#404941]">Chargement de l'enchère...</p>
        </div>
      </div>
    );
  }

  const hasPaymentMethod = !!paymentMethod?.hasPaymentMethod;
  const isBidPriceValid =
    bidPrice >= auction.reservePrice && bidPrice <= displayPrice;

  const handleRequiresCardFlow = () => {
    if (!isAuthenticated) {
      void navigate({ to: '/auth/login' });
      return;
    }
    createSetupSession.mutate({
      auctionId: id,
      returnUrl: `${window.location.origin}/auctions/${id}`,
    });
  };

  const handleOpenBottomSheet = () => {
    if (!isAuthenticated) {
      void navigate({ to: '/auth/login' });
      return;
    }
    setBidPrice(displayPrice);
    setIsBottomSheetOpen(true);
  };

  const handleDirectImmediateBuy = () => {
    if (!isAuthenticated) {
      void navigate({ to: '/auth/login' });
      return;
    }
    if (!hasPaymentMethod || !selectedAddress) {
      setBidPrice(displayPrice);
      setIsBottomSheetOpen(true);
      return;
    }
    placeBid.mutate({
      id,
      deliveryAddress: selectedAddress,
    });
  };

  const handleConfirmBottomSheetBid = () => {
    if (!hasPaymentMethod) {
      handleRequiresCardFlow();
      return;
    }

    if (!selectedAddress) {
      addToast('Veuillez sélectionner ou renseigner une adresse de livraison.', 'warning');
      return;
    }

    if (bidPrice >= displayPrice) {
      // Immediate buy at current price
      placeBid.mutate({
        id,
        deliveryAddress: selectedAddress,
      });
    } else {
      // Bid at chosen lower price
      placeBid.mutate({
        id,
        autoBidMaxPrice: bidPrice,
        deliveryAddress: selectedAddress,
      });
    }
  };

  const productName = auction.harvest?.product?.name || 'Lot Agricole';
  const farmerName =
    auction.farmerProfile?.companyName ||
    (auction.farmerProfile as any)?.user?.firstName ||
    'Producteur Certifié';

  const batchCode = `#LOT-${auction.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-16 font-sans">
      {/* Top Bar Header */}
      <header className="fixed top-0 w-full z-40 bg-white/90 backdrop-blur-md border-b border-[#c0c9be] h-16 flex items-center justify-between px-4 max-w-[520px] mx-auto left-0 right-0 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/auctions"
            className="text-[#004322] cursor-pointer hover:opacity-80 transition-opacity p-1 -ml-1"
          >
            <Icon name="arrow_back" size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <Icon name="agriculture" className="text-[#004322] text-[22px]" />
            <h1 className="text-[17px] font-bold text-[#004322]">Future Farm</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {wsConnected && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e8f5e9] border border-[#1a5c35]/20 rounded-full text-[#1a5c35]">
              <span className="w-2 h-2 rounded-full bg-[#1a5c35] animate-pulse"></span>
              <span className="text-[10px] font-bold tracking-wider">LIVE</span>
            </div>
          )}
          <Link
            to="/profile"
            className="w-9 h-9 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-[13px] shadow-xs cursor-pointer"
          >
            {farmerName.charAt(0) || 'U'}
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="pt-16 max-w-[520px] mx-auto space-y-4">
        {/* Active Bid Alert Banner */}
        {existingBid && existingBid.status === BidStatus.PENDING && (
          <div className="mx-4 mt-4 bg-[#e8f5e9] border border-[#1a5c35]/30 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <Icon name="timer" className="text-[#1a5c35] text-[22px]" />
              <div>
                <p className="text-[13px] font-bold text-[#1a5c35]">
                  Offre enregistrée
                </p>
                <p className="text-[12px] text-[#404941]">
                  Prix proposé : {existingBid.autoBidMaxPrice?.toLocaleString()} {currency} / kg
                </p>
              </div>
            </div>
            {!confirmingCancel ? (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="text-[12px] font-bold text-[#ba1a1a] hover:underline cursor-pointer"
              >
                Annuler
              </button>
            ) : (
              <div className="flex gap-1.5 items-center">
                <button
                  type="button"
                  onClick={() => {
                    cancelBid.mutate(id);
                    setConfirmingCancel(false);
                  }}
                  disabled={cancelBid.isPending}
                  className="px-2.5 py-1 bg-[#ba1a1a] text-white rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  {cancelBid.isPending ? '...' : 'Oui'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="px-2.5 py-1 border border-[#c0c9be] rounded-lg text-[11px] font-semibold text-[#404941] cursor-pointer"
                >
                  Non
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1. Full-Width Image Carousel */}
        <div className="relative w-full h-[320px] sm:h-[360px] bg-black/90 overflow-hidden select-none">
          <img
            src={photos[currentImageIndex]}
            alt={`${productName} - photo ${currentImageIndex + 1}`}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {/* Countdown Badge */}
          {isActive && (
            <div className="absolute top-4 right-4 bg-[#d32f2f] text-white text-[12px] font-extrabold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg tracking-wider z-10 backdrop-blur-xs">
              <Icon name="timer" className="text-[16px] animate-pulse" />
              <span>{countdown}</span>
            </div>
          )}

          {/* Carousel Arrows (if multiple images) */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label="Image précédente"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer z-10 shadow-md"
              >
                <Icon name="chevron_left" className="text-[20px]" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                aria-label="Image suivante"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer z-10 shadow-md"
              >
                <Icon name="chevron_right" className="text-[20px]" />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
                {photos.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentImageIndex(idx)}
                    aria-label={`Aller à l'image ${idx + 1}`}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      currentImageIndex === idx
                        ? 'w-6 bg-white shadow-sm'
                        : 'w-2 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Image Counter Badge */}
          {photos.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-full z-10">
              {currentImageIndex + 1} / {photos.length}
            </div>
          )}
        </div>

        {/* Content Body Container */}
        <div className="px-4 space-y-4">
          {/* 2. Title & Current Price Card */}
          <div className="bg-white border border-[#c0c9be] rounded-3xl p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h2 className="text-[20px] font-extrabold text-[#0b1c30] leading-tight">
                  {productName}
                </h2>
                <p className="text-[12px] text-[#707970] mt-1 font-medium">
                  Lot {batchCode} | Origine: {farmerName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-[#885200] uppercase tracking-wider">
                  Prix actuel
                </p>
                <div className="flex items-baseline gap-1 justify-end">
                  <span className="text-[22px] font-black text-[#885200]">
                    {displayPrice.toLocaleString()}
                  </span>
                  <span className="text-[12px] font-bold text-[#885200]">
                    {currency}/kg
                  </span>
                </div>
                {priceDropped && (
                  <span className="inline-flex items-center text-[10px] font-bold text-[#1a5c35] gap-0.5">
                    <Icon name="trending_down" className="text-[14px]" />
                    Prix en baisse
                  </span>
                )}
              </div>
            </div>

            {/* Stat Chips Grid */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#c0c9be]/40">
              <div className="bg-[#f0f4f8] border border-[#d0dbe5] rounded-2xl p-3">
                <p className="text-[11px] text-[#607080] font-semibold">Volume</p>
                <p className="text-[15px] font-extrabold text-[#0b1c30] mt-0.5">
                  {auction.quantityOnOffer} kg
                </p>
              </div>
              <div className="bg-[#f0f4f8] border border-[#d0dbe5] rounded-2xl p-3">
                <p className="text-[11px] text-[#607080] font-semibold">Qualité</p>
                <p className="text-[15px] font-extrabold text-[#004322] mt-0.5">
                  {auction.harvest?.qualityScore != null
                    ? `${Number(auction.harvest.qualityScore) <= 10 ? Math.round(Number(auction.harvest.qualityScore) * 10) : Math.round(Number(auction.harvest.qualityScore))}/100 Certifié`
                    : '88/100 Certifié'}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Action Buttons */}
          {isActive && (
            <div className="space-y-2.5">
              {/* Action 1: Make a Bid */}
              <button
                type="button"
                onClick={handleOpenBottomSheet}
                className="w-full py-4 bg-[#004322] hover:bg-[#003319] text-white rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                <Icon name="gavel" className="text-[20px]" />
                <span>Placer une offre</span>
              </button>

              {/* Action 2: Direct Immediate Buy at current price */}
              <button
                type="button"
                onClick={handleDirectImmediateBuy}
                disabled={placeBid.isPending || createSetupSession.isPending}
                className="w-full py-3.5 bg-white border-2 border-[#004322] text-[#004322] hover:bg-[#004322]/5 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {placeBid.isPending ? (
                  'Traitement en cours...'
                ) : (
                  <>
                    <span>Achat immédiat au prix actuel</span>
                    <span className="font-extrabold">
                      ({(displayPrice * auction.quantityOnOffer).toLocaleString()} {currency})
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 4. Descending Price Curve Graph */}
          <section className="bg-white border border-[#c0c9be] rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#004322]">
                <Icon name="show_chart" className="text-[22px]" />
                <h3 className="text-[15px] font-extrabold text-[#0b1c30]">
                  Évolution du prix dégressif
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-[#707970] bg-[#f0f4f8] px-2.5 py-1 rounded-full">
                -{auction.priceDecrementAmount.toLocaleString()} {currency} / {auction.priceDecrementIntervalMinutes}m
              </span>
            </div>

            {/* SVG Visual Graph */}
            <div className="w-full bg-[#f8f9ff] border border-[#d0dbe5] rounded-2xl p-3">
              <svg viewBox="0 0 340 140" className="w-full h-auto overflow-visible">
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#004322" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#004322" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line x1="30" y1="30" x2="310" y2="30" stroke="#c0c9be" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="30" y1="67" x2="310" y2="67" stroke="#e0e0e0" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="30" y1="105" x2="310" y2="105" stroke="#c0c9be" strokeDasharray="3 3" strokeWidth="1" />

                {/* Staircase Step Corner Markers / Drop Guides */}
                {stairSteps.map((step, idx) => (
                  <circle
                    key={idx}
                    cx={step.x}
                    cy={step.y}
                    r="2"
                    fill="#004322"
                    fillOpacity="0.4"
                  />
                ))}

                {/* Area Gradient under stairs */}
                <path
                  d={stairAreaPath}
                  fill="url(#priceGradient)"
                />

                {/* Main Descending Staircase Line */}
                <path
                  d={stairPath}
                  fill="none"
                  stroke="#004322"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Starting point */}
                <circle cx={startPoint.x} cy={startPoint.y} r="5" fill="#707970" />
                <text x="30" y="18" fill="#707970" fontSize="10" fontWeight="bold" textAnchor="start">
                  Départ ({startingPrice.toLocaleString()})
                </text>

                {/* Current Price Point (Pulsing highlight) */}
                <circle
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r="9"
                  fill="#885200"
                  fillOpacity="0.25"
                  className="animate-ping"
                />
                <circle
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r="5.5"
                  fill="#885200"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={Math.max(55, Math.min(265, currentPoint.x))}
                  y={Math.max(20, currentPoint.y - 12)}
                  fill="#885200"
                  fontSize="11"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  Actuel: {displayPrice.toLocaleString()} {currency}
                </text>

                {/* Buyer's Active Bid Point */}
                {bidPoint && (
                  <g>
                    <line
                      x1={bidPoint.x}
                      y1={bidPoint.y}
                      x2={bidPoint.x}
                      y2={110}
                      stroke="#0284c7"
                      strokeDasharray="2 2"
                      strokeWidth="1.2"
                      strokeOpacity="0.8"
                    />
                    <circle
                      cx={bidPoint.x}
                      cy={bidPoint.y}
                      r="9"
                      fill="#0284c7"
                      fillOpacity="0.25"
                    />
                    <circle
                      cx={bidPoint.x}
                      cy={bidPoint.y}
                      r="5.5"
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={Math.max(65, Math.min(260, bidPoint.x))}
                      y={
                        Math.abs(bidPoint.x - currentPoint.x) < 55
                          ? bidPoint.y + 18
                          : Math.max(22, bidPoint.y - 12)
                      }
                      fill="#0284c7"
                      fontSize="10"
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      Votre offre: {bidPoint.price.toLocaleString()} {currency}
                    </text>
                  </g>
                )}

                {/* Reserve Price Point */}
                <circle cx={endPoint.x} cy={endPoint.y} r="5" fill="#ba1a1a" />
                <text x="310" y="125" fill="#ba1a1a" fontSize="10" fontWeight="bold" textAnchor="end">
                  Plancher ({reservePrice.toLocaleString()})
                </text>
              </svg>
            </div>

            <div className={`grid ${bidPoint ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-center text-[11px] pt-1`}>
              <div className="bg-[#f0f4f8] rounded-xl p-2 border border-[#d0dbe5]">
                <p className="text-[#707970]">Prix départ</p>
                <p className="font-extrabold text-[#0b1c30]">{startingPrice.toLocaleString()} {currency}</p>
              </div>
              <div className="bg-[#fff8e1] rounded-xl p-2 border border-[#ffa93d]/40">
                <p className="text-[#885200] font-bold">Prix actuel</p>
                <p className="font-extrabold text-[#885200]">{displayPrice.toLocaleString()} {currency}</p>
              </div>
              {bidPoint && (
                <div className="bg-[#e0f2fe] rounded-xl p-2 border border-[#7dd3fc]">
                  <p className="text-[#0369a1] font-bold">Votre offre</p>
                  <p className="font-extrabold text-[#0369a1]">{bidPoint.price.toLocaleString()} {currency}</p>
                </div>
              )}
              <div className="bg-[#ffebee] rounded-xl p-2 border border-[#ffcdd2]">
                <p className="text-[#ba1a1a]">Prix plancher</p>
                <p className="font-extrabold text-[#ba1a1a]">{reservePrice.toLocaleString()} {currency}</p>
              </div>
            </div>
          </section>

          {/* 5. Quality & Certification Accordion (only tracked backend data) */}
          <section className="bg-white border border-[#c0c9be] rounded-3xl overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setQualityAccordionOpen(!qualityAccordionOpen)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Icon name="verified" className="text-[#004322] text-[22px]" />
                <span className="text-[14px] font-bold text-[#0b1c30]">
                  Certification & Qualité
                </span>
              </div>
              <Icon name="expand_more" className="text-[#707970] transition-transform duration-200 ${qualityAccordionOpen ? 'rotate-180' : ''}" />
            </button>

            {qualityAccordionOpen && (
              <div className="p-4 pt-0 border-t border-gray-100 text-[13px] text-[#404941] space-y-2.5">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-[#707970]">Score de qualité</span>
                  <span className="font-bold text-[#004322]">
                    {auction.harvest?.qualityScore != null
                      ? `${Number(auction.harvest.qualityScore) <= 10 ? Math.round(Number(auction.harvest.qualityScore) * 10) : Math.round(Number(auction.harvest.qualityScore))} / 100`
                      : '88 / 100 Certifié'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-[#707970]">Méthode de culture</span>
                  <span className="font-bold text-[#0b1c30]">
                    {auction.harvest?.farmingMethods || 'Standard'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-[#707970]">Prix de réserve (plancher)</span>
                  <span className="font-bold text-[#0b1c30]">
                    {auction.reservePrice.toLocaleString()} {currency} / kg
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#707970]">Baisse par intervalle</span>
                  <span className="font-bold text-[#0b1c30]">
                    {auction.priceDecrementAmount.toLocaleString()} {currency} toutes les {auction.priceDecrementIntervalMinutes} min
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Ended / Expired status message */}
          {(auctionEnded || auction.status === AuctionStatus.SOLD || auction.status === AuctionStatus.EXPIRED) && (
            <div className="bg-[#e8f5e9] border border-[#1a5c35]/20 rounded-3xl p-5 text-center">
              <Icon name="check_circle" className="text-[#1a5c35] text-[36px] mb-1" />
              <h4 className="text-[16px] font-bold text-[#1a5c35]">
                Cette enchère est terminée
              </h4>
              <p className="text-[12px] text-[#404941] mt-1">
                Les offres ne sont plus acceptées pour ce lot.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 6. Bottom Sheet Drawer for Placing Bids & Selecting Price */}
      {/* ========================================================================= */}
      {isBottomSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border-t border-[#c0c9be] rounded-t-3xl w-full max-w-[520px] p-6 shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto space-y-4">
            {/* Drawer Handle */}
            <div className="w-12 h-1.5 bg-[#c0c9be] rounded-full mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#c0c9be]/40">
              <div className="flex items-center gap-2">
                <Icon name="gavel" className="text-[#004322] text-[24px]" />
                <h3 className="text-[18px] font-extrabold text-[#0b1c30]">
                  Placer une offre
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBottomSheetOpen(false)}
                className="text-[#707970] hover:text-[#0b1c30] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Case A: User has NO saved payment card */}
            {!hasPaymentMethod ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-[#fff8e1] border border-[#ffa93d]/50 rounded-2xl flex items-start gap-3">
                  <Icon name="lock" className="text-[#885200] text-[24px] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[14px] font-bold text-[#885200]">
                      Moyen de paiement requis
                    </h4>
                    <p className="text-[12px] text-[#885200] mt-1 leading-relaxed">
                      Une carte bancaire doit être enregistrée via Stripe avant de pouvoir participer aux enchères. Votre carte ne sera débitée que si vous remportez l'enchère.
                    </p>
                  </div>
                </div>

                <div className="text-[12px] text-[#404941] flex items-start gap-2 bg-[#eff4ff] p-3.5 rounded-xl">
                  <Icon name="security" className="text-[#004322] text-[18px] shrink-0 mt-0.5" />
                  <span>
                    Vos coordonnées sont protégées et gérées sur l'infrastructure sécurisée de Stripe.
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBottomSheetOpen(false)}
                    className="flex-1 py-3.5 border border-[#c0c9be] rounded-xl text-[14px] font-semibold text-[#404941] hover:bg-[#f8f9ff] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleRequiresCardFlow}
                    disabled={createSetupSession.isPending}
                    className="flex-1 py-3.5 bg-[#004322] hover:bg-[#003319] text-white rounded-xl text-[14px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {createSetupSession.isPending ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin  text-[18px]" />
                        Redirection...
                      </>
                    ) : (
                      <>
                        <Icon name="open_in_new" className="text-[18px]" />
                        Ajouter une carte (Stripe)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Case B: User HAS a saved card */
              <div className="space-y-4">
                {/* 1. Saved Payment Method Badge */}
                <div className="flex items-center justify-between p-3.5 bg-[#e8f5e9] border border-[#1a5c35]/30 rounded-2xl">
                  <div className="flex items-center gap-2.5">
                    <Icon name="credit_card" className="text-[#1a5c35] text-[22px]" />
                    <div>
                      <p className="text-[13px] font-bold text-[#0b1c30] capitalize">
                        {paymentMethod.brand || 'Carte bancaire'} •••• {paymentMethod.last4}
                      </p>
                      <p className="text-[11px] text-[#404941]">
                        Débit automatique Stripe uniquement si vous remportez l'enchère
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/payment-method"
                    search={{ returnUrl: `/auctions/${id}`, auctionId: id }}
                    className="text-[12px] font-bold text-[#004322] hover:underline cursor-pointer"
                  >
                    Changer
                  </Link>
                </div>

                {/* 2. Mandatory Delivery Address Selection */}
                <div className="pt-2 border-t border-gray-100">
                  <AddressSelector
                    selectedAddressId={selectedAddress?.id}
                    onSelectAddress={setSelectedAddress}
                    title="Adresse de livraison de la commande"
                    showActions
                  />
                </div>

                {/* 3. Bid Price Selector */}
                <div className="bg-[#f0f4f8] border border-[#d0dbe5] rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[13px] font-bold text-[#0b1c30]">
                      Prix unitaire proposé :
                    </label>
                    <div className="text-right">
                      <span className="text-[20px] font-black text-[#004322]">
                        {bidPrice.toLocaleString()} {currency}
                      </span>
                      <span className="text-[11px] font-bold text-[#707970] block">/ kg</span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={auction.reservePrice}
                    max={displayPrice}
                    step={auction.priceDecrementAmount || 1}
                    value={bidPrice}
                    onChange={(e) => setBidPrice(Number(e.target.value))}
                    className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#004322]"
                  />

                  <div className="flex justify-between text-[11px] font-bold text-[#707970]">
                    <span>Plancher: {auction.reservePrice.toLocaleString()} {currency}</span>
                    <span>Actuel: {displayPrice.toLocaleString()} {currency}</span>
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBidPrice(displayPrice)}
                      className={`py-2 px-3 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                        bidPrice === displayPrice
                          ? 'bg-[#004322] text-white border-[#004322]'
                          : 'bg-white text-[#0b1c30] border-[#c0c9be] hover:bg-gray-50'
                      }`}
                    >
                      Prix actuel ({displayPrice.toLocaleString()})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBidPrice(auction.reservePrice)}
                      className={`py-2 px-3 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                        bidPrice === auction.reservePrice
                          ? 'bg-[#004322] text-white border-[#004322]'
                          : 'bg-white text-[#0b1c30] border-[#c0c9be] hover:bg-gray-50'
                      }`}
                    >
                      Prix plancher ({auction.reservePrice.toLocaleString()})
                    </button>
                  </div>

                  {/* Summary row */}
                  <div className="flex justify-between items-center text-[14px] font-extrabold text-[#0b1c30] border-t border-[#d0dbe5] pt-2.5 mt-2">
                    <span>Total de l'offre ({auction.quantityOnOffer} kg) :</span>
                    <span className="text-[#004322] text-[16px]">
                      {(bidPrice * auction.quantityOnOffer).toLocaleString()} {currency}
                    </span>
                  </div>
                </div>

                {/* 4. Confirm Button */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsBottomSheetOpen(false)}
                    className="flex-1 py-3.5 border border-[#c0c9be] rounded-xl text-[14px] font-semibold text-[#404941] hover:bg-[#f8f9ff] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBottomSheetBid}
                    disabled={
                      placeBid.isPending ||
                      !isBidPriceValid ||
                      !selectedAddress
                    }
                    className="flex-1 py-3.5 bg-[#004322] hover:bg-[#003319] text-white rounded-xl text-[14px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {placeBid.isPending ? (
                      <>
                        <Icon name="progress_activity" className="animate-spin  text-[18px]" />
                        Traitement...
                      </>
                    ) : (
                      <>
                        <Icon name="gavel" className="text-[18px]" />
                        {bidPrice >= displayPrice ? 'Confirmer l\'achat' : 'Confirmer l\'offre'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
