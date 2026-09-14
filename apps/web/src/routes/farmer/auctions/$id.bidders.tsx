import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  getAuctionDetailsQuery,
  getAuctionBidsQuery,
  cancelAuctionMutation,
} from '@/features/auctions/api/auctions.queries';
import { getFarmerProfileQuery } from '@/features/profile/api/profile.queries';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';
import { useCurrencyStore } from '@/features/currency/store/currency.store';
import { addToast } from '@/features/shared/store/toast.store';
import { AuctionStatus, AuctionEvent } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/auctions/$id/bidders')({
  component: AuctionBiddersPage,
});

function formatCountdown(endAt: string | undefined): string {
  if (!endAt) return '00:00';
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'Terminée';
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatDateFriendly(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (isToday) return `Aujourd'hui à ${hours}:${minutes}`;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year} à ${hours}:${minutes}`;
}

function formatTimeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `Il y a ${diffHrs} h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `Il y a ${diffDays} j`;
}

function AuctionBiddersPage() {
  useFarmerLayout({ hideTopBar: true });
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const currencies = useCurrencyStore((s) => s.currencies);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);

  // Fetch auction details and bids
  const { data: auction, isLoading, refetch: refetchAuction } = useQuery(getAuctionDetailsQuery(id));
  const { data: bids, refetch: refetchBids } = useQuery(getAuctionBidsQuery(id));
  const { data: profile } = useQuery(getFarmerProfileQuery());

  // Live WebSocket state
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('00:00');
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  // WebSockets for live Dutch price ticks and events
  useEffect(() => {
    if (!id) return;
    const apiBase = (import.meta.env['VITE_API_BASE_URL'] as string) || '';
    const wsUrl = apiBase.replace(/\/v1\/?$/, '') || window.location.origin;

    const socket = io(`${wsUrl}/auctions`, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_auction', { auctionId: id });
    });

    socket.on(AuctionEvent.PRICE_TICK, (data: { auctionId: string; currentPrice: number }) => {
      if (data.auctionId === id) {
        setCurrentPrice(data.currentPrice);
        void refetchBids();
      }
    });

    socket.on(
      AuctionEvent.AUCTION_SOLD,
      (data: { auctionId: string; priceAtBid?: number; currentPrice?: number }) => {
        if (data.auctionId === id) {
          setAuctionEnded(true);
          setCurrentPrice(data.priceAtBid ?? data.currentPrice ?? null);
          addToast('Votre lot a été acheté !', 'success');
          void refetchAuction();
          void refetchBids();
        }
      },
    );

    socket.on(AuctionEvent.AUCTION_EXPIRED, (data: { auctionId: string }) => {
      if (data.auctionId === id) {
        setAuctionEnded(true);
        addToast("L'enchère a expiré.", 'info');
        void refetchAuction();
        void refetchBids();
      }
    });

    socket.on(AuctionEvent.AUCTION_CANCELLED, (data: { auctionId: string }) => {
      if (data.auctionId === id) {
        setAuctionEnded(true);
        addToast("L'enchère a été annulée.", 'info');
        void refetchAuction();
        void refetchBids();
      }
    });

    return () => {
      socket.emit('leave_auction', { auctionId: id });
      socket.disconnect();
    };
  }, [id, refetchAuction, refetchBids]);

  // Live countdown timer
  useEffect(() => {
    if (!auction?.endAt) return;
    setCountdown(formatCountdown(auction.endAt));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(auction.endAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [auction?.endAt]);

  const displayPrice = currentPrice ?? Number(auction?.currentPrice || auction?.startingPrice || 0);
  const currency = auction?.currency || selectedCurrency || 'CDF';
  const currencySymbol = useMemo(() => {
    const curr = currencies.find((c) => c.code === currency);
    return curr?.symbol || currency;
  }, [currencies, currency]);

  const unit = auction?.harvest?.unit?.toLowerCase() || 'kg';
  const productName = auction?.harvest?.product?.name || `Lot #${id.slice(0, 4)}`;

  // Staircase Graph calculations matching the buyer side
  const startingPrice = Number(auction?.startingPrice) || displayPrice;
  const reservePrice = Number(auction?.reservePrice) || (displayPrice > 0 ? displayPrice * 0.7 : 0);
  const priceRange = Math.max(1, startingPrice - reservePrice);
  const progressRatio = Math.max(0, Math.min(1, (startingPrice - displayPrice) / priceRange));

  const startPoint = { x: 30, y: 30, price: startingPrice };
  const endPoint = { x: 310, y: 105, price: reservePrice };

  const { stairPath, stairAreaPath, stairSteps, currentPoint } = useMemo(() => {
    const startX = 30;
    const endX = 310;
    const startY = 30;
    const endY = 105;
    const totalW = endX - startX;
    const totalH = endY - startY;

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

      // Horizontal plateau, then vertical drop
      pathD += ` L ${curX},${prevY} L ${curX},${curY}`;
      stepsArr.push({ x: prevX, y: prevY, nextX: curX, price: stepPrice });
    }

    const areaD = `${pathD} L ${endX},120 L ${startX},120 Z`;

    const currentStepIdx = Math.min(stepCount - 1, Math.floor(progressRatio * stepCount));
    const stepFraction = progressRatio * stepCount - currentStepIdx;
    const currentPlateau = stepsArr[currentStepIdx] || { x: startX, y: startY, nextX: endX };
    const curX = currentPlateau.x + stepFraction * (currentPlateau.nextX - currentPlateau.x);
    const curY = currentPlateau.y;

    return {
      stairPath: pathD,
      stairAreaPath: areaD,
      stairSteps: stepsArr,
      currentPoint: {
        x: Math.max(startX, Math.min(endX, curX)),
        y: curY,
        price: displayPrice,
      },
    };
  }, [startingPrice, reservePrice, priceRange, progressRatio, auction?.priceDecrementAmount, displayPrice]);

  // Calculate bid markers on the staircase graph
  const bidPoints = useMemo(() => {
    if (!bids || bids.length === 0 || !stairSteps.length) return [];
    const startX = 30;
    const endX = 310;
    const stepCount = stairSteps.length;

    return bids
      .map((b) => {
        const priceVal = b.autoBidMaxPrice ? Number(b.autoBidMaxPrice) : Number(b.priceAtBid);
        if (isNaN(priceVal) || priceVal < reservePrice || priceVal > startingPrice) return null;

        const bidProgressRatio = Math.max(0, Math.min(1, (startingPrice - priceVal) / priceRange));
        const bidStepIdx = Math.min(stepCount - 1, Math.floor(bidProgressRatio * stepCount));
        const bidFraction = bidProgressRatio * stepCount - bidStepIdx;
        const bidPlateau = stairSteps[bidStepIdx] || { x: startX, y: 30, nextX: endX };
        const bX = bidPlateau.x + bidFraction * (bidPlateau.nextX - bidPlateau.x);
        const bY = bidPlateau.y;

        return {
          id: b.id,
          buyerId: b.buyerId,
          x: Math.max(startX, Math.min(endX, bX)),
          y: bY,
          price: priceVal,
          status: b.status,
          isAutoBid: !!b.isAutoBid,
        };
      })
      .filter((pt): pt is NonNullable<typeof pt> => pt !== null);
  }, [bids, stairSteps, reservePrice, startingPrice, priceRange]);

  // Cancel auction mutation
  const { mutate: cancelAuction, isPending: isCancelling } = useMutation({
    ...cancelAuctionMutation(),
    onSuccess: () => {
      addToast('Enchère annulée avec succès. Le stock a été restitué.', 'success');
      setConfirmCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['auctions'] });
      void refetchAuction();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || "Erreur lors de l'annulation de l'enchère";
      addToast(msg, 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="text-center space-y-3">
          <Icon name="progress_activity" className="text-4xl text-[#004322] animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#404941]">Chargement de l'enchère...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-[#c0c9be] rounded-2xl p-6 text-center space-y-3 max-w-sm">
          <Icon name="error_outline" className="text-4xl text-red-600 mx-auto" />
          <h2 className="text-base font-bold text-[#0b1c30]">Enchère introuvable</h2>
          <p className="text-xs text-[#404941]">Cette enchère n'existe pas ou a été supprimée.</p>
          <Link
            to="/farmer/auctions"
            className="inline-block px-4 py-2 bg-[#004322] text-white text-xs font-bold rounded-xl"
          >
            Retour aux enchères
          </Link>
        </div>
      </div>
    );
  }

  const isSold = auction.status === AuctionStatus.SOLD || !!auction.soldAt || !!auction.winnerId;
  const isActive = auction.status === AuctionStatus.ACTIVE && !auctionEnded;
  const isScheduled = auction.status === AuctionStatus.SCHEDULED;
  const isExpired = auction.status === AuctionStatus.EXPIRED;
  const isCancelled = auction.status === AuctionStatus.CANCELLED;

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex flex-col items-center font-sans">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-40 bg-white border-b border-[#c0c9be] flex items-center justify-between px-4 py-3 max-w-[480px] shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/farmer/auctions"
            className="text-[#004322] active:scale-95 transition-transform cursor-pointer p-1 -ml-1 shrink-0"
          >
            <Icon name="arrow_back" size={24} />
          </Link>
          <h1 className="text-[17px] font-bold text-[#004322] truncate">
            {productName}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-[#707970] tracking-wider">
              Prix actuel
            </span>
            <span className="block text-[17px] font-extrabold text-[#885200]">
              {displayPrice.toLocaleString('fr-FR')} {currencySymbol}
            </span>
          </div>

          <Link
            to="/farmer/profile"
            className="w-9 h-9 rounded-full border border-[#c0c9be] overflow-hidden bg-[#004322]/10 flex items-center justify-center cursor-pointer"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={user?.firstName || 'Farmer'}
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon name="person" size={20} className="text-[#004322]" />
            )}
          </Link>
        </div>
      </header>

      {/* Main Canvas with increased bottom padding so content scrolls above elevated action buttons & bottom nav */}
      <main className="w-full flex-1 max-w-[480px] pb-44 px-4 space-y-6 pt-4">
        {/* Price Evolution Section (Staircase Chart) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-[#004322] flex items-center gap-1.5">
              <Icon name="show_chart" size={20} className="text-[#004322]" />
              <span>Évolution du prix</span>
            </h2>

            {isActive && (
              <div className="flex items-center gap-1 text-[#885200] font-bold text-xs bg-[#fff8e1] border border-[#ffa93d]/30 px-2.5 py-1 rounded-full">
                <Icon name="timer" size={14} />
                <span>Fin dans {countdown}</span>
              </div>
            )}
            {isScheduled && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Programmée
              </span>
            )}
            {isSold && (
              <span className="text-xs font-bold text-[#004322] bg-[#d1f2d9] border border-[#aef2be] px-2.5 py-0.5 rounded-full">
                Vendu
              </span>
            )}
            {isExpired && (
              <span className="text-xs font-bold text-gray-700 bg-gray-100 border border-gray-300 px-2.5 py-0.5 rounded-full">
                Expirée
              </span>
            )}
            {isCancelled && (
              <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Annulée
              </span>
            )}
          </div>

          {/* SVG Staircase Chart Card */}
          <div className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs text-[#707970] pb-1 border-b border-gray-100">
              <span>
                Décroissance :{' '}
                <strong className="text-gray-900 font-semibold">
                  -{auction.priceDecrementAmount.toLocaleString('fr-FR')} {currencySymbol}
                </strong>
              </span>
              <span>
                Intervalle :{' '}
                <strong className="text-gray-900 font-semibold">
                  {auction.priceDecrementIntervalMinutes} min
                </strong>
              </span>
            </div>

            {/* Staircase SVG */}
            <div className="w-full bg-[#f8f9ff] border border-[#d0dbe5] rounded-xl p-2.5">
              <svg viewBox="0 0 340 140" className="w-full h-auto overflow-visible">
                <defs>
                  <linearGradient id="farmerPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#004322" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#004322" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line x1="30" y1="30" x2="310" y2="30" stroke="#c0c9be" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="30" y1="67" x2="310" y2="67" stroke="#e0e0e0" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="30" y1="105" x2="310" y2="105" stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1" />

                {/* Staircase Step Corner Markers */}
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
                <path d={stairAreaPath} fill="url(#farmerPriceGradient)" />

                {/* Main Descending Staircase Line */}
                <path
                  d={stairPath}
                  fill="none"
                  stroke="#004322"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Plotted Bids on the Staircase */}
                {bidPoints.map((bp, idx) => (
                  <g key={bp.id || idx}>
                    <line
                      x1={bp.x}
                      y1={bp.y}
                      x2={bp.x}
                      y2={105}
                      stroke="#0284c7"
                      strokeDasharray="2 2"
                      strokeWidth="1.2"
                      strokeOpacity="0.8"
                    />
                    <circle
                      cx={bp.x}
                      cy={bp.y}
                      r="7.5"
                      fill="#0284c7"
                      fillOpacity="0.25"
                    />
                    <circle
                      cx={bp.x}
                      cy={bp.y}
                      r="4.5"
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={Math.max(50, Math.min(270, bp.x))}
                      y={
                        Math.abs(bp.x - currentPoint.x) < 45
                          ? bp.y + 16
                          : Math.max(22, bp.y - 8)
                      }
                      fill="#0369a1"
                      fontSize="9"
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      Offre: {bp.price.toLocaleString('fr-FR')} {currencySymbol}
                    </text>
                  </g>
                ))}

                {/* Starting point */}
                <circle cx={startPoint.x} cy={startPoint.y} r="4.5" fill="#707970" />
                <text
                  x="30"
                  y={currentPoint.x < 75 ? "14" : "18"}
                  fill="#707970"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="start"
                >
                  Départ ({startingPrice.toLocaleString('fr-FR')})
                </text>

                {/* Current Live Price Point */}
                <circle
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r="8"
                  fill="#885200"
                  fillOpacity="0.25"
                  className={isActive ? 'animate-ping' : ''}
                />
                <circle
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r="5"
                  fill="#885200"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <text
                  x={Math.max(currentPoint.x < 75 ? 80 : 55, Math.min(265, currentPoint.x))}
                  y={currentPoint.x < 75 ? currentPoint.y + 18 : Math.max(18, currentPoint.y - 10)}
                  fill="#885200"
                  fontSize="10"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  Actuel: {displayPrice.toLocaleString('fr-FR')} {currencySymbol}
                </text>

                {/* Reserve Floor Price Point */}
                <circle cx={endPoint.x} cy={endPoint.y} r="4.5" fill="#dc2626" />
                <text x="310" y="122" fill="#dc2626" fontSize="9.5" fontWeight="bold" textAnchor="end">
                  Plancher ({reservePrice.toLocaleString('fr-FR')})
                </text>
              </svg>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
              <div className="bg-[#f0f4f8] rounded-xl p-2 border border-[#d0dbe5]">
                <p className="text-[#707970]">Prix départ</p>
                <p className="font-extrabold text-[#0b1c30]">
                  {startingPrice.toLocaleString('fr-FR')} {currencySymbol}
                </p>
              </div>
              <div className="bg-[#fff8e1] rounded-xl p-2 border border-[#ffa93d]/40">
                <p className="text-[#885200] font-bold">Prix actuel</p>
                <p className="font-extrabold text-[#885200]">
                  {displayPrice.toLocaleString('fr-FR')} {currencySymbol}
                </p>
              </div>
              <div className="bg-[#ffebee] rounded-xl p-2 border border-[#ffcdd2]">
                <p className="text-[#dc2626]">Prix plancher</p>
                <p className="font-extrabold text-[#dc2626]">
                  {reservePrice.toLocaleString('fr-FR')} {currencySymbol}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Real Auction Status & Lot Details */}
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-[#004322] flex items-center gap-1.5">
            <Icon name="gavel" size={20} className="text-[#004322]" />
            <span>Statut du lot</span>
          </h2>

          <div className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Quantité en vente</p>
                <p className="text-base font-bold text-gray-900">
                  {Number(auction.quantityOnOffer).toLocaleString('fr-FR')} {unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 text-right">Qualité inspectée</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#004322] bg-[#d1f2d9] px-2.5 py-0.5 rounded-full mt-0.5">
                  <Icon name="verified" size={13} />
                  {auction.harvest?.qualityScore != null
                    ? `${Number(auction.harvest.qualityScore) <= 10 ? Math.round(Number(auction.harvest.qualityScore) * 10) : auction.harvest.qualityScore}%`
                    : 'Approuvé'}
                </span>
              </div>
            </div>

            {/* Buyer Outcome Card */}
            {isSold && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-sm">
                    <Icon name="shopping_bag" size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">
                      {auction.winnerId
                        ? `Acheteur #${auction.winnerId.slice(0, 8)}`
                        : 'Acheteur'}
                    </h4>
                    <p className="text-[11px] text-emerald-800 font-semibold">
                      Acheté au prix de{' '}
                      <strong>
                        {Number(auction.currentPrice).toLocaleString('fr-FR')}{' '}
                        {currencySymbol}/{unit}
                      </strong>
                    </p>
                  </div>
                </div>
                <span className="bg-[#004322] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                  Vendu
                </span>
              </div>
            )}

            {isActive && (
              <div className="bg-[#eff4ff] border border-[#d0dbe5] rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffa93d]/20 text-[#885200] flex items-center justify-center shrink-0">
                  <Icon name="broadcast_on_home" size={20} />
                </div>
                <div className="text-xs text-[#0b1c30]">
                  <p className="font-bold">Enchère en direct</p>
                  <p className="text-[11px] text-gray-600">
                    Les acheteurs peuvent remporter ce lot à tout moment au prix affiché ou placer une auto-offre.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Real Bids / Bidders List */}
        {bids && bids.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-[#004322] flex items-center gap-1.5">
                <Icon name="group" size={20} className="text-[#004322]" />
                <span>Offres & Acheteurs</span>
              </h2>
              <span className="text-xs font-semibold text-[#707970] bg-gray-100 px-2.5 py-0.5 rounded-full">
                {bids.length} offre{bids.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2">
              {bids.map((bid) => {
                const isAccepted = bid.status === 'ACCEPTED';
                const bidPrice = Number(bid.autoBidMaxPrice || bid.priceAtBid);

                return (
                  <div
                    key={bid.id}
                    className={`bg-white border rounded-xl p-3.5 flex items-center justify-between transition-all ${
                      isAccepted
                        ? 'border-[#004322] bg-[#004322]/5 shadow-xs ring-1 ring-[#004322]'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                          isAccepted
                            ? 'bg-[#004322] text-white'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <Icon name={isAccepted ? 'check' : 'person'} size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">
                          Acheteur #{bid.buyerId.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {bid.isAutoBid ? 'Auto-offre max : ' : 'Offre : '}
                          <strong className="text-gray-800">
                            {bidPrice.toLocaleString('fr-FR')} {currencySymbol}/{unit}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                        isAccepted
                          ? 'bg-[#004322] text-white'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {isAccepted ? 'Acheté' : 'En attente'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Real Activity Timeline */}
        <section className="space-y-3">
          <h2 className="text-[17px] font-bold text-[#004322] flex items-center gap-1.5">
            <Icon name="history" size={20} className="text-[#004322]" />
            <span>Activité de l'enchère</span>
          </h2>

          <div className="bg-white border border-[#c0c9be] rounded-2xl p-4 shadow-xs space-y-4 relative before:absolute before:left-7 before:top-5 before:bottom-5 before:w-0.5 before:bg-gray-200">
            {/* Event: Sold */}
            {isSold && (
              <div className="flex items-start gap-3 relative">
                <div className="w-7 h-7 rounded-full bg-[#004322] text-white flex items-center justify-center shrink-0 z-10 shadow-xs">
                  <Icon name="check" size={16} />
                </div>
                <div className="pt-0.5 flex-1">
                  <p className="text-xs font-bold text-gray-900">
                    Offre remportée {auction.winnerId ? `par Acheteur #${auction.winnerId.slice(0, 8)}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Prix final : {Number(auction.currentPrice).toLocaleString('fr-FR')}{' '}
                    {currencySymbol}/{unit} {auction.soldAt ? `• ${formatTimeAgo(auction.soldAt)}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Event: Next Price Drop (If active) */}
            {isActive && auction.nextDecrementAt && (
              <div className="flex items-start gap-3 relative">
                <div className="w-7 h-7 rounded-full bg-[#ffa93d] text-white flex items-center justify-center shrink-0 z-10 shadow-xs">
                  <Icon name="trending_down" size={16} />
                </div>
                <div className="pt-0.5 flex-1">
                  <p className="text-xs font-bold text-[#885200]">
                    Prochaine baisse programmée
                  </p>
                  <p className="text-[11px] text-gray-500">
                    -{auction.priceDecrementAmount.toLocaleString('fr-FR')} {currencySymbol} à{' '}
                    {formatDateFriendly(auction.nextDecrementAt.toString())}
                  </p>
                </div>
              </div>
            )}

            {/* Event: Auction Started */}
            <div className="flex items-start gap-3 relative">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 z-10 shadow-xs">
                <Icon name="play_arrow" size={16} />
              </div>
              <div className="pt-0.5 flex-1">
                <p className="text-xs font-bold text-gray-900">
                  {isScheduled ? "Début programmé de l'enchère" : "Ouverture de l'enchère"}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatDateFriendly(auction.startAt?.toString())}
                </p>
              </div>
            </div>

            {/* Event: Auction Created */}
            <div className="flex items-start gap-3 relative">
              <div className="w-7 h-7 rounded-full bg-gray-400 text-white flex items-center justify-center shrink-0 z-10 shadow-xs">
                <Icon name="add" size={16} />
              </div>
              <div className="pt-0.5 flex-1">
                <p className="text-xs font-bold text-gray-900">Enchère initialisée</p>
                <p className="text-[11px] text-gray-500">
                  Lot de {Number(auction.quantityOnOffer).toLocaleString('fr-FR')} {unit} • Départ à{' '}
                  {Number(auction.startingPrice).toLocaleString('fr-FR')} {currencySymbol}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Action Footer for Farmer - Elevated above bottom nav */}
      <footer className="fixed bottom-16 w-full max-w-[480px] z-40 bg-white/95 backdrop-blur-md border-t border-[#c0c9be] p-3.5 flex gap-3 shadow-lg">
        {(isActive || isScheduled) && (
          <button
            type="button"
            onClick={() => setConfirmCancelOpen(true)}
            className="flex-1 py-3 px-4 bg-white border border-red-300 text-red-700 font-bold rounded-xl active:scale-95 transition-transform cursor-pointer text-xs flex items-center justify-center gap-1.5 hover:bg-red-50"
          >
            <Icon name="cancel" size={16} />
            <span>Annuler l'enchère</span>
          </button>
        )}

        <Link
          to="/farmer/auctions"
          className="flex-[2] py-3 px-4 bg-[#004322] hover:bg-[#00331a] text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer text-xs"
        >
          <Icon name="gavel" size={16} />
          <span>Mes Enchères</span>
        </Link>
      </footer>

      {/* Confirm Cancellation Modal */}
      {confirmCancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Icon name="warning" size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-gray-900">Annuler cette enchère ?</h3>
              <p className="text-xs text-gray-600">
                L'enchère sera immédiatement clôturée et la quantité réservée (
                {Number(auction.quantityOnOffer).toLocaleString('fr-FR')} {unit}) sera restituée à
                votre stock.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200 cursor-pointer"
              >
                Garder active
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => cancelAuction(id)}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isCancelling ? 'Annulation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
