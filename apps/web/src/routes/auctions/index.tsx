import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuctionsQuery } from '@/features/auctions/api/auctions.queries';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import { AuctionStatus } from '@futurefarm/types';

export const Route = createFileRoute('/auctions/')({
  component: AuctionsListPage,
});

const CATEGORIES = ['Toutes', 'Céréales', 'Fruits', 'Légumes'];

function ProductImagePlaceholder({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <div className={`bg-gradient-to-br from-[#1a5c35]/15 to-[#004322]/25 flex items-center justify-center text-[#1a5c35] ${className}`}>
      <Icon name="agriculture" className="text-[32px] opacity-70" />
    </div>
  );
}

function ProducerAvatar({
  name,
  avatarUrl,
  size = 'w-12 h-12',
}: {
  name: string;
  avatarUrl?: string | null | undefined;
  size?: string;
}) {
  const initial = (name || 'P').trim().charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} rounded-full object-cover border border-[#c0c9be] shadow-xs`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-[#e8f5e9] text-[#004322] border border-[#c0c9be] flex items-center justify-center font-bold text-[14px] shadow-xs`}
    >
      {initial}
    </div>
  );
}

function AuctionsListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');

  const { data: paginatedData } = useQuery(
    getAuctionsQuery({ status: AuctionStatus.ACTIVE }),
  );
  const allAuctions = paginatedData?.data || [];

  const activeAuctions = useMemo(
    () => allAuctions.filter((a) => a.status === AuctionStatus.ACTIVE),
    [allAuctions],
  );

  const filteredAuctions = useMemo(() => {
    return activeAuctions.filter((a) => {
      // Search
      const matchesSearch =
        !searchQuery ||
        (a as any).harvest?.product?.name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (a as any).harvest?.variety
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase());

      // Category
      const matchesCategory =
        selectedCategory === 'Toutes' ||
        (a as any).harvest?.product?.category
          ?.toLowerCase()
          .includes(selectedCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [activeAuctions, searchQuery, selectedCategory]);

  // Extract unique producers who have at least one active auction
  const producers = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; avatarUrl?: string | null }
    >();
    activeAuctions.forEach((a: any) => {
      const farmer = a.farmerProfile;
      const farmerId = farmer?.id || a.farmerProfileId;
      if (farmerId && !map.has(farmerId)) {
        const name =
          farmer?.companyName ||
          farmer?.farmName ||
          farmer?.user?.name ||
          'Producteur';
        const avatarUrl = farmer?.avatarUrl || farmer?.user?.avatarUrl || null;
        map.set(farmerId, {
          id: farmerId,
          name,
          avatarUrl,
        });
      }
    });
    return Array.from(map.values());
  }, [activeAuctions]);

  // Featured auction: first filtered active auction
  const featuredAuction = filteredAuctions[0];
  const remainingAuctions = filteredAuctions.slice(1);

  const formatTimeRemaining = (endAt?: string): string => {
    if (!endAt) return 'En cours';
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'Terminée';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-20 font-sans">
      <BuyerHeader
        title="Enchères"
        showBack
        backTo="/marketplace"
      />

      <main className="pt-20 px-4 max-w-[480px] mx-auto flex flex-col gap-3.5">
        {/* Section Title & Live Count */}
        <div className="flex items-center justify-between mt-1">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-bold text-[#0b1c30]">
                Enchères en cours
              </h2>
              {activeAuctions.length > 0 && (
                <span className="bg-[#fff3e0] text-[#e65100] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#e65100] animate-ping"></span>
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#404941] mt-0.5">
              {activeAuctions.length} enchère{activeAuctions.length > 1 ? 's' : ''} active{activeAuctions.length > 1 ? 's' : ''} aujourd'hui
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#707970] text-[20px]" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c0c9be] rounded-xl text-[14px] text-[#0b1c30] placeholder-[#707970] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] focus:outline-none shadow-sm transition-all"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex overflow-x-auto gap-2 pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer shadow-xs ${
                selectedCategory === cat
                  ? 'bg-[#004322] text-white'
                  : 'bg-white text-[#404941] border border-[#c0c9be] hover:bg-[#eff4ff]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Producers Story Horizontal List */}
        {producers.length > 0 && (
          <div className="py-0.5">
            <p className="text-[12px] font-semibold text-[#404941] mb-1.5">
              Producteurs en direct
            </p>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {/* "Toutes ->" Opens full stories carousel */}
              <button
                type="button"
                onClick={() => void navigate({ to: '/auctions/story' })}
                className="flex flex-col items-center gap-1 min-w-[56px] cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-[#004322] text-white flex items-center justify-center transition-all group-hover:scale-105 ring-2 ring-[#004322] ring-offset-1">
                  <Icon name="agriculture" className="text-[20px]" />
                </div>
                <span className="text-[10px] font-bold text-[#004322] truncate max-w-[56px]">
                  Toutes →
                </span>
              </button>

              {/* Individual Producers -> Open Story for that producer */}
              {producers.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: '/auctions/story',
                      search: { producerId: prod.id },
                    })
                  }
                  className="flex flex-col items-center gap-1 min-w-[56px] cursor-pointer group"
                >
                  <div className="transition-all group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#004322] group-hover:ring-offset-1 rounded-full">
                    <ProducerAvatar
                      name={prod.name}
                      avatarUrl={prod.avatarUrl}
                      size="w-12 h-12"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-[#0b1c30] truncate max-w-[56px] group-hover:text-[#004322]">
                    {prod.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Featured Popular Auction Card */}
        {featuredAuction && (
          <div
            onClick={() =>
              void navigate({
                to: '/auctions/$id',
                params: { id: featuredAuction.id },
              })
            }
            className="bg-white border border-[#c0c9be] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
          >
            {/* Image Header */}
            <div className="relative h-52 w-full overflow-hidden bg-[#e0e0e0]">
              {(featuredAuction as any).harvest?.photoUrls?.[0] || (featuredAuction as any).harvest?.images?.[0] ? (
                <img
                  src={
                    (featuredAuction as any).harvest?.photoUrls?.[0] ||
                    (featuredAuction as any).harvest?.images?.[0]
                  }
                  alt={
                    (featuredAuction as any).harvest?.product?.name ||
                    'Lot agricole'
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <ProductImagePlaceholder />
              )}
              <div className="absolute top-3 left-3 bg-[#ff9800] text-white px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1 shadow-md">
                <span>🔥</span> Populaire
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[17px] font-bold text-[#0b1c30]">
                    {(featuredAuction as any).harvest?.product?.name ||
                      (featuredAuction as any).harvest?.variety ||
                      'Lot agricole'}
                  </h3>
                  <p className="text-[12px] text-[#404941] flex items-center gap-1 mt-0.5">
                    <Icon name="verified" className="text-[15px] text-[#004322]" />
                    {(featuredAuction as any).farmerProfile?.companyName ||
                      (featuredAuction as any).farmerProfile?.farmName ||
                      (featuredAuction as any).farmerProfile?.user?.name ||
                      'Ferme certifiée'}{' '}
                    • {featuredAuction.quantityOnOffer} kg
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-extrabold text-[#004322]">
                    {featuredAuction.currentPrice.toLocaleString()}{' '}
                    <span className="text-[12px] font-semibold text-[#404941]">
                      {featuredAuction.currency || 'CDF'}/kg
                    </span>
                  </p>
                  {(featuredAuction as any).harvest?.qualityScore ? (
                    <span className="inline-block bg-[#e8f5e9] text-[#1a5c35] text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5">
                      IA : {Number((featuredAuction as any).harvest.qualityScore) <= 10
                        ? Math.round(Number((featuredAuction as any).harvest.qualityScore) * 10)
                        : Math.round(Number((featuredAuction as any).harvest.qualityScore))}% Qualité
                    </span>
                  ) : (featuredAuction as any).harvest?.qualityGrade ? (
                    <span className="inline-block bg-[#e8f5e9] text-[#1a5c35] text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5">
                      Qualité {(featuredAuction as any).harvest.qualityGrade}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Status footer with countdown */}
              <div className="flex items-center justify-between text-[12px] text-[#404941] border-t border-[#c0c9be]/40 pt-3">
                <div className="flex items-center gap-1.5 text-[#d32f2f] font-bold">
                  <Icon name="alarm" className="text-[18px]" />
                  <span>{formatTimeRemaining(featuredAuction.endAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#707970] font-medium">
                  <Icon name="gavel" className="text-[16px]" />
                  <span>
                    {featuredAuction.status === AuctionStatus.ACTIVE
                      ? 'En direct'
                      : 'Programmée'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Secondary Auctions List */}
        <div className="flex flex-col gap-3">
          {remainingAuctions.map((auc) => {
            const isActive = auc.status === AuctionStatus.ACTIVE;
            const productName =
              (auc as any).harvest?.product?.name ||
              (auc as any).harvest?.variety ||
              'Lot agricole';
            const producerName =
              (auc as any).farmerProfile?.companyName ||
              (auc as any).farmerProfile?.farmName ||
              (auc as any).farmerProfile?.user?.name ||
              'Producteur';
            const currency = auc.currency || 'CDF';
            const harvestImage =
              (auc as any).harvest?.photoUrls?.[0] ||
              (auc as any).harvest?.images?.[0];
            const qualityScore = (auc as any).harvest?.qualityScore;
            const qualityGrade = (auc as any).harvest?.qualityGrade;

            return (
              <div
                key={auc.id}
                onClick={() =>
                  void navigate({
                    to: '/auctions/$id',
                    params: { id: auc.id },
                  })
                }
                className="bg-white border border-[#c0c9be] rounded-2xl p-3 flex gap-3 shadow-xs hover:shadow-sm transition-all active:scale-[0.99] cursor-pointer"
              >
                {/* Square Left Image */}
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-[#f0f0f0] relative">
                  {harvestImage ? (
                    <img
                      src={harvestImage}
                      alt={productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ProductImagePlaceholder className="w-full h-full" />
                  )}
                  {isActive ? (
                    <div className="absolute top-1.5 left-1.5 bg-[#004322] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      LIVE
                    </div>
                  ) : null}
                </div>

                {/* Info Right */}
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="text-[14px] font-bold text-[#0b1c30] leading-snug">
                        {productName}
                      </h4>
                      <p className="text-[14px] font-extrabold text-[#004322]">
                        {auc.currentPrice.toLocaleString()}{' '}
                        <span className="text-[10px] font-semibold text-[#404941]">
                          {currency}
                        </span>
                      </p>
                    </div>
                    <p className="text-[11px] text-[#404941] mt-0.5">
                      {producerName} • {auc.quantityOnOffer} kg
                    </p>
                    {qualityScore ? (
                      <span className="inline-block bg-[#e8f5e9] text-[#1a5c35] text-[9px] font-bold px-1.5 py-0.2 rounded mt-1">
                        IA : {Number(qualityScore) <= 10 ? Math.round(Number(qualityScore) * 10) : Math.round(Number(qualityScore))}%
                      </span>
                    ) : qualityGrade ? (
                      <span className="inline-block bg-[#e8f5e9] text-[#1a5c35] text-[9px] font-bold px-1.5 py-0.2 rounded mt-1">
                        Qualité {qualityGrade}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#707970] mt-1">
                    <span className="flex items-center gap-1 font-semibold text-[#d32f2f]">
                      <Icon name="schedule" className="text-[14px]" />
                      {formatTimeRemaining(auc.endAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon name="gavel" className="text-[14px]" />
                      En direct
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredAuctions.length === 0 && (
          <div className="bg-white border border-[#c0c9be] rounded-2xl p-8 text-center text-[#404941]">
            <Icon name="gavel" className="text-[48px] text-[#707970] mb-2 block" />
            <p className="font-semibold">Aucune enchère trouvée</p>
            <p className="text-[12px] text-[#707970] mt-1">
              Essayez de modifier vos filtres ou revenez plus tard.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

