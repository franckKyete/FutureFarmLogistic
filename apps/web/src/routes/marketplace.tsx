import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getMarketplaceHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { getAuctionsQuery } from '@/features/auctions/api/auctions.queries';
import { getBasketQuery } from '@/features/basket/api/basket.queries';
import { BuyerHeader } from '@/features/buyer/components/BuyerHeader';
import { AuctionStatus, type HarvestDto, type AuctionDto, type ProductCategory } from '@futurefarm/types';
import { formatCurrencyPrice } from '@/features/currency/store/currency.store';

export const Route = createFileRoute('/marketplace')({
  component: MarketplacePage,
});

const CATEGORIES: { label: string; value: ProductCategory | null }[] = [
  { label: 'All', value: null },
  { label: 'Vegetables', value: 'VEGETABLES' as ProductCategory },
  { label: 'Fruits', value: 'FRUITS' as ProductCategory },
  { label: 'Cereals', value: 'CEREALS' as ProductCategory },
  { label: 'Dates', value: 'DATES' as ProductCategory },
  { label: 'Dairy', value: 'DAIRY' as ProductCategory },
  { label: 'Meat', value: 'MEAT' as ProductCategory },
  { label: 'Other', value: 'OTHER' as ProductCategory },
];

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

export function MarketplacePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory | null>(null);

  const { data: rawHarvests, isLoading } = useQuery(getMarketplaceHarvestsQuery(activeCategory));
  const { data: auctionsData } = useQuery(getAuctionsQuery({ status: AuctionStatus.ACTIVE }));

  const { data: basket } = useQuery({
    ...getBasketQuery(),
    enabled: isAuthenticated,
  });

  const basketLineCount = useMemo(() => {
    if (!isAuthenticated || !basket?.lines) return 0;
    return basket.lines.length;
  }, [isAuthenticated, basket]);

  // Extract unique producers who have at least one active auction for the story row
  const producers = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; avatarUrl?: string | null }
    >();
    if (auctionsData?.data) {
      auctionsData.data.forEach((a: any) => {
        if (a.status === AuctionStatus.ACTIVE) {
          const farmer = a.farmerProfile;
          const farmerId = farmer?.id || a.farmerProfileId;
          if (farmerId && !map.has(farmerId)) {
            const name =
              farmer?.companyName ||
              farmer?.farmName ||
              farmer?.user?.name ||
              'Producteur';
            const avatarUrl =
              farmer?.avatarUrl || farmer?.user?.avatarUrl || null;
            map.set(farmerId, {
              id: farmerId,
              name,
              avatarUrl,
            });
          }
        }
      });
    }
    return Array.from(map.values());
  }, [auctionsData]);

  const activeAuctionHarvestMap = useMemo(() => {
    const map = new Map<string, AuctionDto>();
    if (auctionsData?.data) {
      auctionsData.data.forEach((auc) => {
        if (auc.harvestId && (auc.status === AuctionStatus.ACTIVE || auc.status === AuctionStatus.SCHEDULED)) {
          map.set(auc.harvestId, auc);
        }
      });
    }
    return map;
  }, [auctionsData]);

  const harvests: HarvestDto[] = useMemo(() => {
    if (!rawHarvests) return [];
    if (Array.isArray(rawHarvests)) return rawHarvests;
    if (Array.isArray((rawHarvests as any).data)) return (rawHarvests as any).data;
    return [];
  }, [rawHarvests]);

  const filteredHarvests = useMemo(() => {
    return harvests.filter((h) => {
      if (h.status !== 'APPROVED') return false;
      if (activeCategory && h.product?.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = h.product?.name?.toLowerCase() || '';
        const methods = h.farmingMethods?.toLowerCase() || '';
        if (!name.includes(q) && !methods.includes(q)) return false;
      }
      return true;
    });
  }, [harvests, activeCategory, searchQuery]);

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-28 font-sans">
      <BuyerHeader title="Future Farm" hideCart />

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-4">
        {/* Search input matching design */}
        <div className="relative">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-[20px]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, farms..."
            className="w-full h-11 pl-10 pr-10 bg-white border border-gray-300 rounded-2xl text-[13px] text-[#0b1c30] placeholder:text-gray-400 focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322] shadow-xs transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <Icon name="close" size={18} />
            </button>
          ) : (
            <Icon name="search" size={20} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          )}
        </div>

        {/* Category Pills matching design */}
        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value ?? 'all'}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-5 py-2 rounded-full text-[13px] transition-all whitespace-nowrap cursor-pointer shadow-xs ${
                  isActive
                    ? 'bg-[#004322] text-white font-semibold'
                    : 'bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Producers Live Auction Story Row */}
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

        {/* 2-Column Grid matching design */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-9 h-9 border-3 border-[#004322] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredHarvests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-xs">
            <Icon name="inventory_2" className="text-[48px] text-gray-400 mb-2 block" />
            <p className="text-[#404941] font-semibold text-sm">No products available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filteredHarvests.map((harvest) => {
              const auction = activeAuctionHarvestMap.get(harvest.id);
              return (
                <MarketplaceHarvestCard
                  key={harvest.id}
                  harvest={harvest}
                  auction={auction}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Action Button (FAB) for Shopping Cart */}
      <Link
        to={isAuthenticated ? '/cart' : '/auth/login'}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#ea8e1b] hover:bg-[#d97d0e] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all duration-200 cursor-pointer"
        aria-label="View Shopping Cart"
      >
        <Icon name="shopping_cart" className="text-[26px]" />
        {basketLineCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#004322] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
            {basketLineCount > 99 ? '99+' : basketLineCount}
          </span>
        )}
      </Link>
    </div>
  );
}

function MarketplaceHarvestCard({
  harvest,
  auction,
}: {
  harvest: HarvestDto;
  auction?: AuctionDto | undefined;
}) {
  const photoUrl = harvest.photoUrls?.[0];
  const qualityScore = harvest.qualityScore !== undefined && harvest.qualityScore !== null
    ? Math.round(
        Number(harvest.qualityScore) <= 10
          ? Number(harvest.qualityScore) * 10
          : Number(harvest.qualityScore),
      )
    : null;

  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = qualityScore !== null ? circumference * (1 - qualityScore / 100) : 0;

  const gaugeColor =
    qualityScore !== null
      ? qualityScore >= 80
        ? '#10b981'
        : qualityScore >= 65
        ? '#f59e0b'
        : '#ef4444'
      : '#9ca3af';

  // Format harvest date (e.g. "Oct 2026")
  const dateObj = new Date(harvest.harvestDate || harvest.createdAt);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  // Unit display
  const unitSuffix = (() => {
    switch (harvest.unit) {
      case 'KG':
        return 'kg';
      case 'TON':
        return 'ton';
      case 'PIECE':
        return 'pc';
      default:
        return harvest.unit?.toLowerCase() || 'unit';
    }
  })();

  // Price calculation
  const displayPrice = auction
    ? formatCurrencyPrice(Number(auction.currentPrice), auction.currency || 'CDF')
    : formatCurrencyPrice(Number(harvest.pricePerUnit), harvest.currency || 'CDF');

  // Stock formatting
  const stockFormatted = (() => {
    const qty = Number(harvest.quantityInStock || 0);
    if (harvest.unit === 'TON') {
      return `${qty}t`;
    }
    if (qty >= 1000) {
      return `${(qty / 1000).toFixed(1).replace('.0', '')}t`;
    }
    return `${qty}${unitSuffix}`;
  })();

  const targetLink = auction ? '/auctions/$id' : '/harvests/$id';
  const targetId = auction ? auction.id : harvest.id;

  return (
    <Link
      to={targetLink}
      params={{ id: targetId }}
      className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col cursor-pointer text-inherit no-underline"
    >
      {/* Card Image area */}
      <div className="relative w-full aspect-square bg-[#eff4ff] overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={harvest.product?.name || 'Product'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#eff4ff]">
            <Icon name="image" className="text-gray-400 text-[36px]" />
          </div>
        )}

        {/* ON AUCTION Top-Left Badge */}
        {auction && (
          <div className="absolute top-0 left-0 bg-[#8c520d] text-white text-[9px] sm:text-[10px] font-extrabold px-2.5 py-1 rounded-br-xl uppercase tracking-wider shadow-xs z-10">
            ON AUCTION
          </div>
        )}

        {/* Circular Quality Score Badge Top-Right */}
        {qualityScore !== null && (
          <div
            className="absolute top-2 right-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center shadow-xs z-10"
            title={`Quality: ${qualityScore}%`}
          >
            <svg className="w-full h-full p-0.5 transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r={radius}
                fill="transparent"
                stroke="#E5E7EB"
                strokeWidth="2.5"
              />
              <circle
                cx="50%"
                cy="50%"
                r={radius}
                fill="transparent"
                stroke={gaugeColor}
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] sm:text-[11px] font-black text-gray-900">
                {qualityScore}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Card Content area */}
      <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-1.5">
        {/* Title + Date Pill */}
        <div className="flex items-center justify-between gap-1">
          <h3 className="text-[13px] sm:text-[14px] font-bold text-[#0b1c30] truncate flex-1">
            {harvest.product?.name || 'Product'}
          </h3>
          <span className="bg-[#e8edf7] text-[#4d6b9c] text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
            {formattedDate}
          </span>
        </div>

        {/* Price & Stock Row */}
        <div className="flex items-baseline justify-between gap-1 pt-0.5">
          <div className="min-w-0">
            <span
              className={`text-[14px] sm:text-[16px] font-black ${
                auction ? 'text-[#8c520d]' : 'text-[#0b1c30]'
              }`}
            >
              {displayPrice}
            </span>
            <span className="text-[10px] sm:text-[11px] text-gray-500 font-normal ml-0.5">
              /{unitSuffix}
            </span>
          </div>

          <span className="text-[10px] sm:text-[11px] text-gray-500 font-semibold shrink-0">
            Stock: {stockFormatted}
          </span>
        </div>
      </div>
    </Link>
  );
}
