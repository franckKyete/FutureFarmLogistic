import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFarmerHarvestsQuery,
  getHarvestDetailsQuery,
  updateHarvestMutation,
} from '@/features/harvests/api/harvests.queries';
import { useFarmerLayout } from '@/features/farmer/store/farmer-layout.store';
import { addToast } from '@/features/shared/store/toast.store';
import type { HarvestDto } from '@futurefarm/types';

export const Route = createFileRoute('/farmer/products/$id')({
  component: ProductDetailPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  CEREALS: 'Céréales',
  VEGETABLES: 'Légumes',
  FRUITS: 'Fruits',
  DATES: 'Dattes',
  DAIRY: 'Laitier',
  MEAT: 'Viande',
  OTHER: 'Autres',
};

const MONTH_COLORS = [
  { bg: 'bg-[#1a5c35]', dot: 'bg-[#1a5c35]', text: 'text-[#1a5c35]', hex: '#1a5c35' },
  { bg: 'bg-[#e67e22]', dot: 'bg-[#e67e22]', text: 'text-[#e67e22]', hex: '#e67e22' },
  { bg: 'bg-[#2c3e50]', dot: 'bg-[#2c3e50]', text: 'text-[#2c3e50]', hex: '#2c3e50' },
  { bg: 'bg-[#27ae60]', dot: 'bg-[#27ae60]', text: 'text-[#27ae60]', hex: '#27ae60' },
  { bg: 'bg-[#8e44ad]', dot: 'bg-[#8e44ad]', text: 'text-[#8e44ad]', hex: '#8e44ad' },
];

function formatMonthYear(dateString: string | Date | undefined): string {
  if (!dateString) return 'Date inconnue';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Date inconnue';
  const formatted = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatShortMonth(dateString: string | Date | undefined): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'N/A';
  const month = d.toLocaleDateString('fr-FR', { month: 'short' });
  return month.charAt(0).toUpperCase() + month.slice(1).replace('.', '');
}

function formatDateDisplay(dateString: string | Date | undefined): string {
  if (!dateString) return '--';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [editingHarvest, setEditingHarvest] = useState<HarvestDto | null>(null);
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editMarge, setEditMarge] = useState<number | ''>('');
  const [editMethods, setEditMethods] = useState('');

  // Bottom Sheet states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<'actions' | 'select_harvest'>('actions');
  const [selectedHarvestForAuction, setSelectedHarvestForAuction] = useState<string>('');

  // Queries
  const { data: allHarvests = [], isLoading: isLoadingFarmerHarvests } = useQuery(getFarmerHarvestsQuery());
  const { data: directHarvest } = useQuery({
    ...getHarvestDetailsQuery(id),
    enabled: !allHarvests.some((h) => h.id === id || h.productId === id || h.product?.id === id),
  });

  // Resolve target product & its harvest batches
  const { product, batches, primaryHarvest } = useMemo(() => {
    let matchedHarvest = allHarvests.find((h) => h.id === id);
    let targetProductId = matchedHarvest?.productId || matchedHarvest?.product?.id;

    if (!targetProductId) {
      const harvestWithProd = allHarvests.find((h) => h.productId === id || h.product?.id === id);
      if (harvestWithProd) {
        targetProductId = harvestWithProd.productId || harvestWithProd.product?.id;
        matchedHarvest = harvestWithProd;
      }
    }

    if (!targetProductId && directHarvest) {
      targetProductId = directHarvest.productId || directHarvest.product?.id;
      matchedHarvest = directHarvest;
    }

    const relevantBatches = (allHarvests.length > 0 ? allHarvests : directHarvest ? [directHarvest] : []).filter(
      (h) => (targetProductId && (h.productId === targetProductId || h.product?.id === targetProductId)) || h.id === id
    );

    const resolvedProduct =
      matchedHarvest?.product ||
      relevantBatches[0]?.product ||
      (directHarvest?.product ?? null);

    return {
      product: resolvedProduct,
      batches: relevantBatches,
      primaryHarvest: matchedHarvest || relevantBatches[0] || directHarvest || null,
    };
  }, [id, allHarvests, directHarvest]);

  const productName = product?.name || primaryHarvest?.product?.name || 'Détails Produit';
  const categoryLabel = product?.category ? (CATEGORY_LABELS[product.category] || product.category) : undefined;

  // Synchronize layout topbar title & back navigation
  useFarmerLayout({
    title: productName,
    showBack: true,
    backTo: '/farmer/stock',
  });

  // Initialize selected batch for auction when batches load
  useEffect(() => {
    if (batches.length > 0 && !selectedHarvestForAuction) {
      const available = batches.find((b) => Number(b.quantityInStock) > 0) || batches[0];
      if (available) {
        setSelectedHarvestForAuction(available.id);
      }
    }
  }, [batches, selectedHarvestForAuction]);

  // Aggregate metrics across batches
  const {
    totalAvailableStock,
    unit,
    overallQualityPercent,
    heroImage,
    monthlyGroups,
    distributionSegments,
  } = useMemo(() => {
    let totalStock = 0;
    let totalScored = 0;
    let scoreSum = 0;
    let unitFound = 'kg';
    let img: string | null = null;

    const groupsMap: Record<
      string,
      {
        monthKey: string;
        monthDisplay: string;
        shortMonth: string;
        harvests: HarvestDto[];
        totalRemaining: number;
        totalAdded: number;
        avgPrice: number;
        avgQuality: number | null;
        earliestExpiration: string;
        status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'PENDING' | 'FLAGGED_PHYSICAL' | 'REJECTED';
      }
    > = {};

    batches.forEach((b) => {
      const stock = Number(b.quantityInStock || 0);
      const originalStock = Number(b.quantityInStock || 0);
      const price = Number(b.pricePerUnit || 0);
      const quality = b.qualityScore != null ? Number(b.qualityScore) : null;
      unitFound = b.unit || unitFound;

      if (!img && b.photoUrls && b.photoUrls.length > 0) {
        img = b.photoUrls[0] || null;
      }

      if (b.status === 'APPROVED') {
        totalStock += stock;
      }

      if (quality != null && !isNaN(quality) && quality > 0) {
        const normalizedScore = quality <= 10 ? quality * 10 : quality;
        scoreSum += normalizedScore;
        totalScored += 1;
      }

      const monthKey = b.harvestDate
        ? new Date(b.harvestDate).toISOString().slice(0, 7)
        : 'unknown';
      const monthDisplay = formatMonthYear(b.harvestDate);
      const shortMonth = formatShortMonth(b.harvestDate);

      if (!groupsMap[monthKey]) {
        groupsMap[monthKey] = {
          monthKey,
          monthDisplay,
          shortMonth,
          harvests: [],
          totalRemaining: 0,
          totalAdded: 0,
          avgPrice: price,
          avgQuality: null,
          earliestExpiration: b.expirationDate ? String(b.expirationDate) : '',
          status: 'AVAILABLE',
        };
      }

      const group = groupsMap[monthKey]!;
      group.harvests.push(b);
      group.totalRemaining += stock;
      group.totalAdded += originalStock;

      if (b.expirationDate) {
        if (!group.earliestExpiration || new Date(b.expirationDate) < new Date(group.earliestExpiration)) {
          group.earliestExpiration = String(b.expirationDate);
        }
      }
    });

    const groupsList = Object.values(groupsMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    groupsList.forEach((group) => {
      let grpScoreSum = 0;
      let grpScoreCount = 0;
      let grpPriceSum = 0;

      group.harvests.forEach((h) => {
        grpPriceSum += Number(h.pricePerUnit || 0);
        if (h.qualityScore != null && Number(h.qualityScore) > 0) {
          const s = Number(h.qualityScore);
          grpScoreSum += s <= 10 ? s * 10 : s;
          grpScoreCount += 1;
        }
      });

      group.avgPrice = group.harvests.length > 0 ? Math.round(grpPriceSum / group.harvests.length) : 0;
      group.avgQuality = grpScoreCount > 0 ? Math.round(grpScoreSum / grpScoreCount) : null;

      const hasApproved = group.harvests.some((h) => h.status === 'APPROVED');
      const hasFlagged = group.harvests.some((h) => h.status === 'FLAGGED_PHYSICAL');
      const hasPending = group.harvests.some((h) => h.status === 'PENDING_APPROVAL');

      if (group.totalRemaining <= 0) {
        group.status = 'OUT_OF_STOCK';
      } else if (hasApproved) {
        group.status = 'AVAILABLE';
      } else if (hasFlagged) {
        group.status = 'FLAGGED_PHYSICAL';
      } else if (hasPending) {
        group.status = 'PENDING';
      } else {
        group.status = 'REJECTED';
      }
    });

    const sumAdded = groupsList.reduce((acc, g) => acc + (g.totalRemaining > 0 ? g.totalRemaining : g.totalAdded), 0);
    const segments = groupsList.map((g, idx) => {
      const weight = g.totalRemaining > 0 ? g.totalRemaining : g.totalAdded;
      const pct = sumAdded > 0 ? Math.max(8, Math.round((weight / sumAdded) * 100)) : 100 / (groupsList.length || 1);
      const colorScheme = MONTH_COLORS[idx % MONTH_COLORS.length] || MONTH_COLORS[0]!;
      return {
        month: g.shortMonth,
        percentage: pct,
        color: colorScheme,
      };
    });

    const avgQualityFinal = totalScored > 0 ? Math.round(scoreSum / totalScored) : null;

    return {
      totalAvailableStock: totalStock,
      unit: unitFound,
      overallQualityPercent: avgQualityFinal,
      heroImage:
        img ||
        'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=800&q=80',
      monthlyGroups: groupsList,
      distributionSegments: segments,
    };
  }, [batches]);

  // Update harvest mutation
  const { mutate: updateHarvest, isPending: isUpdating } = useMutation({
    mutationFn: async ({ harvestId, data }: { harvestId: string; data: any }) => {
      return updateHarvestMutation(harvestId).mutationFn(data);
    },
    onSuccess: () => {
      addToast('Le lot de récolte a été mis à jour.', 'success');
      setEditingHarvest(null);
      void queryClient.invalidateQueries({ queryKey: ['harvests'] });
    },
    onError: () => {
      addToast('Erreur lors de la mise à jour du lot.', 'error');
    },
  });

  const handleOpenEdit = (harvest: HarvestDto) => {
    setEditingHarvest(harvest);
    setEditPrice(harvest.pricePerUnit != null ? Number(harvest.pricePerUnit) : '');
    setEditMarge(harvest.stockMarge != null ? Number(harvest.stockMarge) : '');
    setEditMethods(harvest.farmingMethods || '');
  };

  const handleSaveEdit = () => {
    if (!editingHarvest) return;
    updateHarvest({
      harvestId: editingHarvest.id,
      data: {
        pricePerUnit: editPrice === '' ? undefined : Number(editPrice),
        stockMarge: editMarge === '' ? undefined : Number(editMarge),
        farmingMethods: editMethods || undefined,
      },
    });
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const handleOpenAuctionSelector = () => {
    if (batches.length === 0) {
      addToast('Aucune récolte disponible pour ce produit.', 'warning');
      return;
    }
    setSheetView('select_harvest');
    setIsSheetOpen(true);
  };

  const handleProceedToAuction = () => {
    if (!selectedHarvestForAuction) {
      addToast('Veuillez sélectionner un lot de récolte.', 'warning');
      return;
    }
    setIsSheetOpen(false);
    void navigate({
      to: '/farmer/auctions/new',
      search: { harvestId: selectedHarvestForAuction },
    });
  };

  if (isLoadingFarmerHarvests && batches.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a5c35] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-gray-500">Chargement de la fiche produit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-gray-900 pb-16 relative">
      {/* Main Content Body */}
      <main className="px-4 pt-3 max-w-[480px] mx-auto space-y-5">
        {/* Hero Stock & Image Card */}
        <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
          {/* Hero Image with Quality Badge */}
          <div className="relative h-64 w-full bg-gray-100 overflow-hidden">
            <img
              src={heroImage}
              alt={productName}
              className="w-full h-full object-cover"
            />
            {overallQualityPercent !== null && (
              <div className="absolute top-4 right-4 bg-black/65 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-1.5 shadow-md border border-white/20">
                <span className="text-amber-400 text-sm">★</span>
                <span>{overallQualityPercent}% Qualité</span>
              </div>
            )}
          </div>

          {/* Stock Metrics & Multi-segment Bar */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  STOCK TOTAL DISPONIBLE
                </p>
                <p className="text-3xl font-extrabold text-[#1a5c35] tracking-tight mt-0.5 font-display">
                  {totalAvailableStock.toLocaleString()} {unit}
                </p>
              </div>
              {categoryLabel && (
                <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider self-start">
                  {categoryLabel}
                </span>
              )}
            </div>

            {/* Multi-color Distribution Bar */}
            {distributionSegments.length > 0 && (
              <div className="space-y-2">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden flex">
                  {distributionSegments.map((seg, idx) => (
                    <div
                      key={idx}
                      className={`h-full ${seg.color.bg}`}
                      style={{ width: `${seg.percentage}%` }}
                      title={`${seg.month} • ${seg.percentage}%`}
                    />
                  ))}
                </div>

                {/* Legend with Dots */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-700 pt-0.5">
                  {distributionSegments.map((seg, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${seg.color.dot}`} />
                      <span>{seg.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Auction Button */}
            <button
              type="button"
              onClick={handleOpenAuctionSelector}
              className="w-full py-3.5 bg-[#1a5c35] hover:bg-[#144a2a] text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all"
            >
              <Icon name="gavel" className="text-xl" />
              <span>Mettre en enchère</span>
            </button>
          </div>
        </section>

        {/* Section: Récoltes par mois */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-bold text-gray-900">Récoltes par mois</h2>
            <span className="text-xs font-semibold text-gray-500">
              {monthlyGroups.length} {monthlyGroups.length <= 1 ? 'période' : 'périodes'}
            </span>
          </div>

          {monthlyGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3 shadow-2xs">
              <Icon name="inventory_2" className="text-gray-400 text-3xl" />
              <p className="text-xs text-gray-500">Aucune récolte enregistrée pour ce produit.</p>
              <Link
                to="/farmer/harvests/analyze"
                search={{ productId: product?.id || id }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a5c35] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#144a2a] transition-colors"
              >
                <Icon name="add" className="text-sm" />
                Ajouter une première récolte
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {monthlyGroups.map((group, groupIdx) => {
                const isExpanded =
                  expandedMonths[group.monthKey] ?? (groupIdx === 0);
                const colorScheme =
                  MONTH_COLORS[groupIdx % MONTH_COLORS.length] || MONTH_COLORS[0]!;
                const primaryBatch = group.harvests[0]!;

                return (
                  <div
                    key={group.monthKey}
                    className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3 transition-all"
                  >
                    {/* Month Header row */}
                    <div
                      onClick={() => toggleMonth(group.monthKey)}
                      className="flex items-center justify-between cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${colorScheme.dot}`} />
                        <h3 className="text-sm font-bold text-gray-900">{group.monthDisplay}</h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            group.totalRemaining > 0 ? 'text-gray-900' : 'text-gray-400'
                          }`}
                        >
                          {group.totalRemaining} {unit} restants
                        </span>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            group.status === 'AVAILABLE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : group.status === 'OUT_OF_STOCK'
                              ? 'bg-gray-100 text-gray-500'
                              : group.status === 'FLAGGED_PHYSICAL'
                              ? 'bg-amber-100 text-amber-800'
                              : group.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {group.status === 'AVAILABLE'
                            ? 'DISPONIBLE'
                            : group.status === 'OUT_OF_STOCK'
                            ? 'ÉPUISÉ'
                            : group.status === 'FLAGGED_PHYSICAL'
                            ? 'VISITE REQUISE'
                            : group.status === 'PENDING'
                            ? 'EN ATTENTE'
                            : 'REJETÉ'}
                        </span>
                      </div>
                    </div>

                    {/* Sub-card when Expanded */}
                    {isExpanded ? (
                      <div className="bg-[#f8f9ff] border border-gray-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in-50 duration-150">
                        {/* Circular Quality Gauge */}
                        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                          {group.avgQuality !== null ? (
                            <>
                              <svg viewBox="0 0 60 60" className="w-14 h-14 -rotate-90 block">
                                <circle
                                  cx="30"
                                  cy="30"
                                  fill="transparent"
                                  r="24"
                                  stroke="#E5E7EB"
                                  strokeWidth="5"
                                />
                                <circle
                                  className="text-[#1a5c35]"
                                  cx="30"
                                  cy="30"
                                  fill="transparent"
                                  r="24"
                                  stroke="currentColor"
                                  strokeDasharray="150.79"
                                  strokeDashoffset={150.79 * (1 - group.avgQuality / 100)}
                                  strokeLinecap="round"
                                  strokeWidth="5"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-gray-900 leading-none">
                                  {group.avgQuality}%
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-400">
                              --
                            </div>
                          )}
                        </div>

                        {/* Middle Stats Grid */}
                        <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-4">
                          <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              TOTAL AJOUTÉ
                            </p>
                            <p className="text-xs font-bold text-gray-800">
                              {group.totalAdded} {unit}
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              PRIX/{unit.toUpperCase()}
                            </p>
                            <p className="text-xs font-bold text-gray-800">
                              {group.avgPrice.toLocaleString()} CDF
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              RÉCOLTES
                            </p>
                            <p className="text-xs font-bold text-gray-800">
                              {group.harvests.length} {group.harvests.length <= 1 ? 'lot' : 'lots'}
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                              EXPIRATION
                            </p>
                            <p className="text-xs font-bold text-red-600">
                              {formatDateDisplay(group.earliestExpiration)}
                            </p>
                          </div>
                        </div>

                        {/* Edit Pencil Icon */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(primaryBatch);
                          }}
                          aria-label="Modifier le lot"
                          className="p-2 rounded-xl text-gray-400 hover:text-[#1a5c35] hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer transition-all shrink-0"
                        >
                          <Icon name="edit" className="text-lg" />
                        </button>
                      </div>
                    ) : (
                      /* Collapsed Subtitle Row */
                      <div
                        onClick={() => toggleMonth(group.monthKey)}
                        className="flex items-center justify-between text-xs font-medium text-gray-500 cursor-pointer pt-1"
                      >
                        <span>
                          {group.totalAdded} {unit} ajoutés
                          {group.avgQuality !== null ? ` • Qualité ${group.avgQuality}%` : ''}
                        </span>
                        <Icon name="chevron_right" className="text-base text-gray-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Action Button (FAB) */}
      {!isSheetOpen && !editingHarvest && (
        <div className="fixed bottom-20 right-4 z-40 max-w-[480px]">
          <button
            type="button"
            onClick={() => {
              setSheetView('actions');
              setIsSheetOpen(true);
            }}
            aria-label="Actions rapides"
            className="w-14 h-14 bg-[#1a5c35] hover:bg-[#144a2a] text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#1a5c35]/30"
          >
            <Icon name="add" className="text-3xl" />
          </button>
        </div>
      )}

      {/* Action Bottom Sheet */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-white rounded-t-3xl max-w-[480px] w-full p-6 pb-12 space-y-5 relative z-10 shadow-2xl border-t border-gray-200 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250">
            {/* Handle drag bar */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto -mt-2 mb-2" />

            {sheetView === 'actions' ? (
              /* Actions Menu View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Actions rapides</h3>
                    <p className="text-xs text-gray-500">{productName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSheetOpen(false)}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    <Icon name="close" className="text-xl" />
                  </button>
                </div>

                <div className="space-y-2.5 pt-1">
                  {/* Action 1: Add new harvest */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetOpen(false);
                      void navigate({
                        to: '/farmer/harvests/analyze',
                        search: { productId: product?.id || id },
                      });
                    }}
                    className="w-full p-4 rounded-2xl border border-gray-200 hover:border-[#1a5c35] hover:bg-emerald-50/50 flex items-center gap-3.5 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-[#1a5c35] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icon name="add_circle" className="text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Ajouter une nouvelle récolte</p>
                      <p className="text-xs text-gray-500 truncate">Scanner et analyser un lot pour ce produit</p>
                    </div>
                    <Icon name="chevron_right" className="text-gray-400 text-xl group-hover:text-[#1a5c35]" />
                  </button>

                  {/* Action 2: Create Auction */}
                  <button
                    type="button"
                    onClick={() => {
                      if (batches.length === 0) {
                        addToast('Aucune récolte disponible pour ce produit.', 'warning');
                        return;
                      }
                      setSheetView('select_harvest');
                    }}
                    className="w-full p-4 rounded-2xl border border-gray-200 hover:border-amber-600 hover:bg-amber-50/50 flex items-center gap-3.5 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Icon name="gavel" className="text-2xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Créer une enchère</p>
                      <p className="text-xs text-gray-500 truncate">Choisir un lot et lancer la vente aux enchères</p>
                    </div>
                    <Icon name="chevron_right" className="text-gray-400 text-xl group-hover:text-amber-800" />
                  </button>
                </div>
              </div>
            ) : (
              /* Select Harvest for Auction View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSheetView('actions')}
                      className="p-1 rounded-full text-gray-600 hover:bg-gray-100 cursor-pointer"
                    >
                      <Icon name="arrow_back" className="text-xl" />
                    </button>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Sélectionner le lot</h3>
                      <p className="text-xs text-gray-500">Choisir le lot à mettre aux enchères</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSheetOpen(false)}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    <Icon name="close" className="text-xl" />
                  </button>
                </div>

                {batches.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">
                    Aucun lot de récolte trouvé pour ce produit.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                    {batches.map((b) => {
                      const isSelected = selectedHarvestForAuction === b.id;
                      const hasStock = Number(b.quantityInStock) > 0;
                      const quality = b.qualityScore != null ? Number(b.qualityScore) : null;
                      const normalizedQuality = quality !== null ? (quality <= 10 ? quality * 10 : quality) : null;

                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            if (hasStock) {
                              setSelectedHarvestForAuction(b.id);
                            }
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            !hasStock
                              ? 'opacity-50 border-gray-200 bg-gray-50 cursor-not-allowed'
                              : isSelected
                              ? 'border-[#1a5c35] bg-emerald-50/50 shadow-xs ring-1 ring-[#1a5c35]'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'border-[#1a5c35] bg-[#1a5c35] text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <Icon name="check" className="text-xs" />
                              )}
                            </div>

                            <div>
                              <p className="text-xs font-bold text-gray-900">
                                Récolte du {formatDateDisplay(b.harvestDate)}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                                <span className="font-semibold text-gray-700">
                                  {b.quantityInStock} {b.unit || unit} dispo
                                </span>
                                {normalizedQuality !== null && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-700 font-semibold">
                                      ★ {normalizedQuality}% Qualité
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                !hasStock
                                  ? 'bg-gray-100 text-gray-500'
                                  : b.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'FLAGGED_PHYSICAL'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {!hasStock ? 'ÉPUISÉ' : b.status === 'APPROVED' ? 'APPROUVÉ' : 'EN ATTENTE'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleProceedToAuction}
                    disabled={!selectedHarvestForAuction}
                    className="w-full py-3.5 bg-[#1a5c35] hover:bg-[#144a2a] disabled:opacity-50 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all text-sm"
                  >
                    <span>Lancer l'enchère</span>
                    <Icon name="arrow_forward" className="text-lg" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Harvest Modal */}
      {editingHarvest && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Modifier le lot récolté</h3>
              <button
                type="button"
                onClick={() => setEditingHarvest(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <Icon name="close" className="text-xl" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Prix unitaire (CDF / {editingHarvest.unit || 'kg'})
                </label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="ex: 2400"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Marge de sécurité stock ({editingHarvest.unit || 'kg'})
                </label>
                <input
                  type="number"
                  value={editMarge}
                  onChange={(e) => setEditMarge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="ex: 50"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">
                  Méthodes de culture
                </label>
                <input
                  type="text"
                  value={editMethods}
                  onChange={(e) => setEditMethods(e.target.value)}
                  placeholder="ex: Culture biologique sous serre"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingHarvest(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 rounded-xl cursor-pointer text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isUpdating}
                className="flex-1 py-2.5 bg-[#1a5c35] hover:bg-[#144a2a] text-white font-bold rounded-xl cursor-pointer text-xs disabled:opacity-50 shadow-xs"
              >
                {isUpdating ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
