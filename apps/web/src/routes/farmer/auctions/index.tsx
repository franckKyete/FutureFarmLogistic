import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getAuctionsQuery } from '@/features/auctions/api/auctions.queries';
import { AuctionStatus } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/auctions/')({
  component: MyAuctionsPage,
});

type TabStatus = 'Live' | 'Upcoming' | 'Finished' | 'Drafts';

function MyAuctionsPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>('Live');

  // Load all auctions
  const { data: paginatedData } = useQuery(getAuctionsQuery());
  const auctions = paginatedData?.data || [];

  // Live WebSocket state overrides
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});
  const [liveTickTimes, setLiveTickTimes] = useState<Record<string, number>>({});

  // Socket connection effect
  useEffect(() => {
    const socketUrl = import.meta.env['VITE_API_BASE_URL']
      ? (import.meta.env['VITE_API_BASE_URL'] as string).replace('/v1', '')
      : window.location.origin;

    const socket = io(`${socketUrl}/auctions`, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to auctions WS room');
      auctions.forEach((auc) => {
        socket.emit('join_auction', { auctionId: auc.id });
      });
    });

    socket.on('auction:price_tick', (data: { auctionId: string; currentPrice: number; nextDecrementAt: string }) => {
      setLivePrices((prev) => ({
        ...prev,
        [data.auctionId]: data.currentPrice,
      }));
      const secondsLeft = Math.max(0, Math.round((new Date(data.nextDecrementAt).getTime() - Date.now()) / 1000));
      setLiveTickTimes((prev) => ({
        ...prev,
        [data.auctionId]: secondsLeft,
      }));
    });

    socket.on('auction:sold', (data: { auctionId: string; priceAtBid: number }) => {
      setLiveStatus((prev) => ({
        ...prev,
        [data.auctionId]: 'SOLD',
      }));
      setLivePrices((prev) => ({
        ...prev,
        [data.auctionId]: data.priceAtBid,
      }));
    });

    socket.on('auction:expired', (data: { auctionId: string }) => {
      setLiveStatus((prev) => ({
        ...prev,
        [data.auctionId]: 'EXPIRED',
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [auctions]);

  // Local ticker countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTickTimes((prev) => {
        const next = { ...prev };
        let updated = false;
        Object.keys(next).forEach((key) => {
          const val = next[key];
          if (val !== undefined && val > 0) {
            next[key] = val - 1;
            updated = true;
          }
        });
        return updated ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSeconds = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusText = (status: AuctionStatus, id: string) => {
    const liveStat = liveStatus[id];
    if (liveStat) return liveStat;
    return status;
  };

  const getFilteredAuctions = () => {
    return auctions.filter((auc) => {
      const status = getStatusText(auc.status, auc.id);
      if (activeTab === 'Live') {
        return status === AuctionStatus.ACTIVE;
      }
      if (activeTab === 'Upcoming') {
        return status === AuctionStatus.SCHEDULED;
      }
      if (activeTab === 'Finished') {
        return status === AuctionStatus.SOLD || status === AuctionStatus.EXPIRED;
      }
      return status === AuctionStatus.CANCELLED;
    });
  };

  const filtered = getFilteredAuctions();

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="w-full top-0 sticky z-40 bg-[#f8f9ff] border-b border-[#c0c9be] flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[#004322]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            agriculture
          </span>
          <h1 className="text-[20px] font-bold text-[#004322]">Future Farm</h1>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 pt-4">
        {/* Title */}
        <div className="mb-4">
          <h2 className="text-[32px] font-semibold mb-3 text-[#0b1c30]">Mes Enchères</h2>
          {/* Horizontal Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {(['Live', 'Upcoming', 'Finished', 'Drafts'] as TabStatus[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-full font-semibold text-[12px] whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#004322] text-white active:scale-95'
                    : 'bg-[#dce9ff] text-[#404941] hover:bg-[#d3e4fe]'
                }`}
              >
                {tab === 'Live' ? 'En direct' : tab === 'Upcoming' ? 'À venir' : tab === 'Finished' ? 'Terminées' : 'Brouillons'}
              </button>
            ))}
          </div>
        </div>

        {/* Auction List */}
        <div className="flex flex-col gap-4">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center text-[#404941]">
              <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">gavel</span>
              Aucune enchère disponible dans cette catégorie.
            </div>
          ) : (
            filtered.map((auc) => {
              const currentPrice = livePrices[auc.id] ?? auc.currentPrice;
              const secondsLeft = liveTickTimes[auc.id] ?? 0;
              const isLive = getStatusText(auc.status, auc.id) === AuctionStatus.ACTIVE;

              if (isLive) {
                return (
                  <div
                    key={auc.id}
                    className="bg-white border border-[#c0c9be] rounded-xl overflow-hidden flex flex-col transition-all active:scale-[0.98]"
                  >
                    {/* Visual */}
                    <div className="relative h-48 w-full bg-slate-200">
                      <div className="absolute top-3 left-3 bg-[#885200] px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white"></span>
                        <span className="text-white font-semibold text-[12px] tracking-wider uppercase">LIVE</span>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-[18px] font-semibold text-[#0b1c30]">Lot #{auc.id.slice(0, 4)}</h3>
                          <p className="text-[#404941] text-[14px]">{auc.quantityOnOffer} kg mis en offre</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#404941] text-[12px] font-semibold">Prix actuel</p>
                          <p className="text-[#004322] text-[18px] font-semibold">
                            {currentPrice.toLocaleString()} FCFA
                          </p>
                        </div>
                      </div>
                      {/* Timer Bar */}
                      <div className="bg-[#e5eeff] rounded-lg p-3 flex items-center justify-between border border-[#c0c9be]/30">
                        <div className="flex items-center gap-2 text-[#885200]">
                          <span className="material-symbols-outlined text-[20px]">timer</span>
                          <span className="text-[18px] font-semibold">
                            {formatSeconds(secondsLeft)}
                          </span>
                        </div>
                        <span className="text-[#404941] text-[12px] font-semibold uppercase">Prochaine baisse</span>
                      </div>
                      <Link
                        to="/farmer/auctions/$id/bidders"
                        params={{ id: auc.id }}
                        className="w-full py-3 bg-[#004322] text-white rounded-lg text-[12px] font-bold uppercase tracking-widest transition-colors hover:bg-[#004322]/90 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Détails & Offres
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </Link>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={auc.id}
                    className="bg-[#eff4ff] border border-[#c0c9be] rounded-xl p-4 flex gap-4 items-center border-dashed opacity-90"
                  >
                    <div className="flex-grow">
                      <span className="text-[#404941] text-[11px] font-bold uppercase">
                        {auc.status}
                      </span>
                      <h4 className="text-[18px] font-semibold text-[#0b1c30]">Lot #{auc.id.slice(0, 4)}</h4>
                      <p className="text-xs text-[#404941]">
                        Départ : {auc.startingPrice.toLocaleString()} FCFA — Réserve : {auc.reservePrice.toLocaleString()} FCFA
                      </p>
                    </div>
                    <Link
                      to="/farmer/auctions/$id/bidders"
                      params={{ id: auc.id }}
                      className="material-symbols-outlined text-[#004322] p-2 bg-white rounded-full border border-[#c0c9be] active:scale-90 transition-transform cursor-pointer"
                    >
                      chevron_right
                    </Link>
                  </div>
                );
              }
            })
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f8f9ff] border-t border-[#c0c9be] flex justify-around items-center h-16 max-w-[480px] mx-auto px-2">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[12px] font-semibold">Accueil</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">grass</span>
          <span className="text-[12px] font-semibold">Stock</span>
        </Link>
        <Link
          to="/farmer/auctions"
          className="flex flex-col items-center justify-center text-[#004322] font-bold hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            gavel
          </span>
          <span className="text-[12px] font-semibold">Enchères</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">local_shipping</span>
          <span className="text-[12px] font-semibold">Commandes</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[12px] font-semibold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
