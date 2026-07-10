import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { getBasketQuery } from '@/features/basket/api/basket.queries';
import type { HarvestDto, ProductCategory, PaginatedResult } from '@futurefarm/types';

export const Route = createFileRoute('/marketplace')({
  component: MarketplacePage,
});

const CATEGORIES: { label: string; value: ProductCategory | null }[] = [
  { label: 'Tout', value: null },
  { label: 'Céréales', value: 'CEREALS' as ProductCategory },
  { label: 'Fruits', value: 'FRUITS' as ProductCategory },
  { label: 'Légumes', value: 'VEGETABLES' as ProductCategory },
  { label: 'Dattes', value: 'DATES' as ProductCategory },
  { label: 'Produits laitiers', value: 'DAIRY' as ProductCategory },
  { label: 'Viande', value: 'MEAT' as ProductCategory },
  { label: 'Autre', value: 'OTHER' as ProductCategory },
];

function MarketplacePage() {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory | null>(null);

  const { data: paginatedHarvests, isLoading } = useQuery({
    queryKey: ['marketplace-harvests'],
    queryFn: async (): Promise<PaginatedResult<HarvestDto>> => {
      const { data } = await apiClient.get<{ data: PaginatedResult<HarvestDto> }>('/harvests');
      return data.data;
    },
  });

  const { data: basket } = useQuery({
    ...getBasketQuery(),
    enabled: isAuthenticated,
  });

  const basketLineCount = useMemo(() => {
    if (!isAuthenticated || !basket) return 0;
    return basket.lines?.length || 0;
  }, [isAuthenticated, basket]);

  const harvests = paginatedHarvests?.data || [];

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

  const groupedHarvests = useMemo(() => {
    const groups: Record<string, { key: string; label: string; items: HarvestDto[] }> = {};

    filteredHarvests.forEach((h) => {
      const date = new Date(h.harvestDate || h.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[monthKey]) {
        groups[monthKey] = {
          key: monthKey,
          label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          items: [],
        };
      }
      groups[monthKey].items.push(h);
    });

    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredHarvests]);

  const unitLabel = (unit: string): string => {
    switch (unit) {
      case 'KG':
        return 'kg';
      case 'TON':
        return 'tonne';
      case 'PIECE':
        return 'pièce';
      default:
        return unit;
    }
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex items-center justify-between px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <h1 className="text-[18px] font-bold text-[#004322]">Marché</h1>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#707970] text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full h-11 pl-10 pr-4 bg-white border border-[#c0c9be] rounded-xl text-[13px] text-[#0b1c30] placeholder:text-[#707970] focus:outline-none focus:border-[#1a5c35] focus:ring-1 focus:ring-[#1a5c35] transition-all"
          />
        </div>

        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value ?? 'all'}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeCategory === cat.value
                  ? 'bg-[#004322] text-white'
                  : 'bg-[#eff4ff] text-[#404941] hover:bg-[#dce9ff]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#1a5c35] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groupedHarvests.length === 0 ? (
          <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center">
            <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">
              inventory_2
            </span>
            <p className="text-[#404941] font-semibold">Aucun produit disponible</p>
          </div>
        ) : (
          groupedHarvests.map((group) => (
            <section key={group.key} className="space-y-3">
              <h2 className="text-[15px] font-bold text-[#0b1c30] capitalize">{group.label}</h2>
              <div className="space-y-3">
                {group.items.map((harvest) => (
                  <HarvestCard key={harvest.id} harvest={harvest} unitLabel={unitLabel} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <Link
        to={isAuthenticated ? '/cart' : '/auth/login'}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#1a5c35] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#004322] active:scale-90 transition-all duration-200 cursor-pointer"
      >
        <span className="material-symbols-outlined text-[24px]">shopping_cart</span>
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {basketLineCount}
        </span>
      </Link>
    </div>
  );
}

function HarvestCard({
  harvest,
  unitLabel,
}: {
  harvest: HarvestDto;
  unitLabel: (unit: string) => string;
}) {
  const qualityScore = harvest.qualityScore ?? 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - qualityScore / 100);

  const displayPrice = harvest.pricePerUnit.toLocaleString();

  return (
    <div className="bg-white border border-[#c0c9be] rounded-xl p-4 flex gap-4 shadow-sm active:scale-[0.98] transition-transform">
      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#eff4ff]">
        {harvest.photoUrls?.[0] ? (
          <img
            src={harvest.photoUrls[0]}
            alt={harvest.product?.name || 'Produit'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[#707970] text-[32px]">image</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-bold text-[#0b1c30] truncate">
                {harvest.product?.name || 'Produit'}
              </h3>
              <p className="text-[12px] font-semibold text-[#1a5c35] mt-0.5">
                {displayPrice} <span className="text-[#707970] font-normal">FCFA / {unitLabel(harvest.unit)}</span>
              </p>
            </div>
            <div className="relative w-10 h-10 shrink-0" title={`Qualité: ${qualityScore}/100`}>
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  fill="transparent"
                  r={radius}
                  stroke="#E5E7EB"
                  strokeWidth="3"
                />
                <circle
                  cx="20"
                  cy="20"
                  fill="transparent"
                  r={radius}
                  stroke="#1a5c35"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[9px] font-bold text-[#0b1c30]">{qualityScore}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          {harvest.farmingMethods && (
            <span className="bg-[#eff4ff] text-[#004322] text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-[100px]">
              {harvest.farmingMethods}
            </span>
          )}
          <span
            className={`text-[10px] font-semibold ${
              harvest.quantityInStock > 0 ? 'text-[#1a5c35]' : 'text-red-500'
            }`}
          >
            {harvest.quantityInStock > 0
              ? `${harvest.quantityInStock} en stock`
              : 'Épuisé'}
          </span>
        </div>
      </div>
    </div>
  );
}
