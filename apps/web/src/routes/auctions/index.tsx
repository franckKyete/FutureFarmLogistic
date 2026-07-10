import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuctionsQuery } from '@/features/auctions/api/auctions.queries';
import { AuctionStatus } from '@futurefarm/types';

export const Route = createFileRoute('/auctions/')({
  component: AuctionsListPage,
});

type FilterChip = 'En cours' | 'À venir' | 'Terminées';

const FILTER_CHIPS: { label: FilterChip; statuses: AuctionStatus[] }[] = [
  { label: 'En cours', statuses: [AuctionStatus.ACTIVE] },
  { label: 'À venir', statuses: [AuctionStatus.SCHEDULED] },
  { label: 'Terminées', statuses: [AuctionStatus.SOLD, AuctionStatus.EXPIRED, AuctionStatus.CANCELLED] },
];

function AuctionsListPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterChip>('En cours');

  const { data: paginatedData } = useQuery(getAuctionsQuery());
  const allAuctions = paginatedData?.data || [];

  const activeStatuses = FILTER_CHIPS.find((f) => f.label === activeFilter)?.statuses ?? [];
  const auctions = useMemo(
    () => allAuctions.filter((a) => activeStatuses.includes(a.status)),
    [allAuctions, activeStatuses],
  );

  const getStatusLabel = (status: AuctionStatus): string => {
    switch (status) {
      case AuctionStatus.ACTIVE:
        return 'En cours';
      case AuctionStatus.SCHEDULED:
        return 'À venir';
      case AuctionStatus.SOLD:
        return 'Vendu';
      case AuctionStatus.EXPIRED:
        return 'Expirée';
      case AuctionStatus.CANCELLED:
        return 'Annulée';
      default:
        return status;
    }
  };

  const getTimeRemaining = (endAt: string): string => {
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'Terminée';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `~${days}j`;
    }
    return `${hours}h ${minutes}min`;
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex items-center justify-between px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="material-symbols-outlined text-[#004322] cursor-pointer">
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322]">Enchères</h1>
        </div>
        <Link
          to="/auctions/story"
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#eff4ff] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[#404941]">slideshow</span>
        </Link>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto">
        {/* Title */}
        <div className="mb-4">
          <h2 className="text-[20px] font-semibold text-[#0b1c30]">Enchères en direct</h2>
          <p className="text-[12px] text-[#404941] mt-1">Prix qui diminuent — soyez le premier à enchérir</p>
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-none">
          {FILTER_CHIPS.map(({ label }) => (
            <button
              key={label}
              onClick={() => setActiveFilter(label)}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === label
                  ? 'bg-[#004322] text-white'
                  : 'bg-[#eff4ff] text-[#404941] hover:bg-[#dce9ff]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Auction List */}
        <div className="flex flex-col gap-4">
          {auctions.length === 0 ? (
            <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center text-[#404941]">
              <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">gavel</span>
              {activeFilter === 'En cours' && "Aucune enchère en cours"}
              {activeFilter === 'À venir' && "Aucune enchère à venir"}
              {activeFilter === 'Terminées' && "Aucune enchère terminée"}
            </div>
          ) : (
            auctions.map((auc) => {
              const isActive = auc.status === AuctionStatus.ACTIVE;

              return (
                <div
                  key={auc.id}
                  onClick={() => void navigate({ to: '/auctions/$id', params: { id: auc.id } })}
                  className="bg-white border border-[#c0c9be] rounded-xl overflow-hidden flex flex-col transition-all active:scale-[0.98] cursor-pointer"
                >
                  {/* Top visual area */}
                  <div className="relative h-40 w-full bg-gradient-to-br from-[#eff4ff] to-[#dce9ff] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[56px] text-[#004322] opacity-30">gavel</span>
                    {isActive && (
                      <div className="absolute top-3 left-3 bg-[#1a5c35] px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white"></span>
                        <span className="text-white font-semibold text-[12px] tracking-wider uppercase">LIVE</span>
                      </div>
                    )}
                    {auc.status === AuctionStatus.SCHEDULED && (
                      <div className="absolute top-3 left-3 bg-[#885200] px-3 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-white text-[14px]">schedule</span>
                        <span className="text-white font-semibold text-[12px] tracking-wider uppercase">À venir</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[16px] font-semibold text-[#0b1c30]">Lot agricole</h3>
                        <p className="text-[#404941] text-[12px]">{auc.quantityOnOffer} kg mis en offre</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#404941] text-[10px] font-semibold uppercase">Prix actuel</p>
                        <p className="text-[#004322] text-[18px] font-bold">
                          {auc.currentPrice.toLocaleString()} FCFA
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[12px]">
                      <div className="flex items-center gap-1 text-[#707970]">
                        <span className="material-symbols-outlined text-[16px]">trending_down</span>
                        <span>Départ: {auc.startingPrice.toLocaleString()} FCFA</span>
                      </div>
                      {isActive && (
                        <div className="flex items-center gap-1 text-[#885200] font-semibold">
                          <span className="material-symbols-outlined text-[16px]">timer</span>
                          <span>{getTimeRemaining(auc.endAt)}</span>
                        </div>
                      )}
                    </div>

                    {!isActive && auc.status !== AuctionStatus.ACTIVE && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#707970]">{getStatusLabel(auc.status)}</span>
                        {auc.status === AuctionStatus.SOLD && (
                          <span className="text-[#1a5c35] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            Vendu
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] flex justify-around items-center py-2 bg-[#f8f9ff] border-t border-[#c0c9be] z-50 rounded-t-xl">
        <Link
          to="/"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[12px] font-semibold">Accueil</span>
        </Link>
        <Link
          to="/auctions"
          className="flex flex-col items-center justify-center text-[#004322] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            gavel
          </span>
          <span className="text-[12px] font-semibold">Enchères</span>
        </Link>
        <Link
          to="/notifications"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          <span className="text-[12px] font-semibold">Alertes</span>
        </Link>
        <Link
          to="/auth/login"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">person</span>
          <span className="text-[12px] font-semibold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
