import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFarmerHarvestsQuery, deleteHarvestMutation } from '@/features/harvests/api/harvests.queries';
import { addToast } from '@/features/shared/store/toast.store';
import {
  useOfflineSyncState,
  syncOfflineHarvests,
  refreshOfflineQueueState,
} from '@/features/harvests/offline';

export const Route = createFileRoute('/farmer/stock')({
  component: StockPage,
});

type Category = 'Tout' | 'Céréales' | 'Légumes' | 'Fruits' | 'Dattes' | 'Laitier';

const CATEGORY_MAP: Record<string, string> = {
  CEREALS: 'Céréales',
  VEGETABLES: 'Légumes',
  FRUITS: 'Fruits',
  DATES: 'Dattes',
  DAIRY: 'Laitier',
  MEAT: 'Viande',
  OTHER: 'Autre',
};

const CATEGORY_REVERSE_MAP: Record<Category, string> = {
  Tout: '',
  Céréales: 'CEREALS',
  Légumes: 'VEGETABLES',
  Fruits: 'FRUITS',
  Dattes: 'DATES',
  Laitier: 'DAIRY',
};

function StockPage() {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<Category>('Tout');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const {
    isOnline,
    pendingCount,
    isSyncing,
    queuedHarvests,
    pendingAnalysisCount,
    readyForReviewCount,
    tempDrafts,
  } = useOfflineSyncState();

  useEffect(() => {
    void refreshOfflineQueueState();
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    await syncOfflineHarvests(queryClient);
  };

  // Fetch harvests query
  const { data: harvests, refetch } = useQuery(getFarmerHarvestsQuery());

  // Archive harvest mutation
  const { mutate: deleteHarvest, isPending: deletePending } = useMutation({
    ...deleteHarvestMutation(),
    onSuccess: () => {
      addToast('Le lot a été archivé avec succès.', 'success');
      void refetch();
    },
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Group harvests by product
  const groups: Record<string, {
    id: string;
    name: string;
    category: string;
    rawCategory: string;
    totalStock: number;
    unit: string;
    imgUrl: string;
    distributions: { name: string; percentage: number; colorClass: string }[];
    details: {
      id: string;
      month: string;
      quality: number;
      stock: string;
      avgPrice: string;
      status: string;
    }[];
  }> = {};

  (harvests || []).forEach((h) => {
    const prod = h.product;
    if (!prod) return;

    let group = groups[prod.id];
    if (!group) {
      group = {
        id: prod.id,
        name: prod.name,
        category: CATEGORY_MAP[prod.category] || prod.category,
        rawCategory: prod.category,
        totalStock: 0,
        unit: h.unit,
        imgUrl: h.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=200',
        distributions: [],
        details: [],
      };
      groups[prod.id] = group;
    }

    group.totalStock += Number(h.quantityInStock);

    const harvestMonth = new Date(h.harvestDate).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });

    group.details.push({
      id: h.id,
      month: harvestMonth.charAt(0).toUpperCase() + harvestMonth.slice(1),
      quality: h.qualityScore ? Math.round(h.qualityScore * 10) : 0,
      stock: `${h.quantityInStock} ${h.unit}`,
      avgPrice: `${Number(h.pricePerUnit).toLocaleString()} CDF/${h.unit}`,
      status: h.status,
    });
  });

  // Calculate percentage distributions
  Object.values(groups).forEach((g) => {
    const total = g.totalStock;
    if (total > 0 && g.details.length > 0) {
      g.distributions = g.details.map((detail, idx) => {
        const qty = parseFloat(detail.stock);
        const pct = total > 0 ? Math.round((qty / total) * 100) : 0;
        const colors = ['bg-primary', 'bg-surface-tint', 'bg-primary-container', 'bg-secondary'];
        return {
          name: detail.month.split(' ')[0] || 'Batch',
          percentage: pct,
          colorClass: colors[idx % colors.length] || 'bg-primary',
        };
      });
    } else {
      g.distributions = [{ name: 'Aucun', percentage: 100, colorClass: 'bg-outline-variant' }];
    }
  });

  const productGroups = Object.values(groups);

  const filteredGroups = productGroups.filter((group) => {
    const matchesCategory = activeCategory === 'Tout' || group.rawCategory === CATEGORY_REVERSE_MAP[activeCategory];
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Dynamic statistics
  const activeCount = harvests ? harvests.filter((h) => h.status === 'APPROVED').length : 0;
  const lowStockCount = harvests
    ? harvests.filter((h) => h.status === 'APPROVED' && Number(h.quantityInStock) <= Number(h.stockMarge) && Number(h.quantityInStock) > 0).length
    : 0;
  const outOfStockCount = harvests ? harvests.filter((h) => Number(h.quantityInStock) === 0).length : 0;

  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen relative">
      <main className="pt-4 px-4 max-w-[480px] mx-auto space-y-6">
        {/* Alert Banner */}
        {lowStockCount > 0 && (
          <div className="bg-[#ffddbb] text-[#2b1700] flex items-center justify-between p-3.5 rounded-xl border border-[#ffa93d]/30 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">warning</span>
              <span className="text-xs font-semibold">{lowStockCount} produits ont un stock faible</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            to="/farmer/harvests/analyze"
            className="flex-1 bg-primary text-white py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer text-center"
          >
            <span className="material-symbols-outlined">analytics</span>
            Ajouter une récolte
          </Link>
          <button
            onClick={() => void refetch()}
            className="flex-1 bg-white border border-outline-variant text-on-surface py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined">refresh</span>
            Mettre à jour
          </button>
        </div>

        {/* Drafts Ready for Review Section */}
        {readyForReviewCount > 0 && (
          <section className="bg-[#eff4ff] border-2 border-[#004322] p-4 rounded-xl shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004322] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                <span className="text-xs font-bold text-[#004322]">
                  {readyForReviewCount} récolte{readyForReviewCount > 1 ? 's' : ''} analysée{readyForReviewCount > 1 ? 's' : ''} à réviser
                </span>
              </div>
              <span className="bg-[#004322] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                À confirmer
              </span>
            </div>
            <div className="space-y-2 pt-1">
              {tempDrafts
                .filter((d) => d.status === 'ANALYZED_READY_FOR_REVIEW')
                .map((draft) => (
                  <div key={draft.id} className="bg-white p-3 rounded-lg border border-[#c0c9be] flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a5c35]/10 flex items-center justify-center text-[#1a5c35] shrink-0">
                        {draft.localPhotos && draft.localPhotos[0] ? (
                          <img alt="Vignette" className="w-full h-full object-cover" src={draft.localPhotos[draft.featuredPhotoIndex || 0] || draft.localPhotos[0]} />
                        ) : (
                          <span className="material-symbols-outlined text-xl">psychology</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0b1c30]">
                          {draft.manualForm?.productName || draft.aiResult?.suggestedName || 'Lot récolté'}
                        </p>
                        <p className="text-[10px] text-[#707970]">
                          Qualité IA : {draft.aiResult?.aiQualityScore ? Math.round(draft.aiResult.aiQualityScore * 10) : 90}% • {draft.manualForm?.quantity || 0} {draft.manualForm?.unit || 'KG'}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/farmer/harvests/new"
                      search={{ reviewDraftId: draft.id }}
                      className="bg-[#004322] hover:bg-[#1a5c35] text-white py-1.5 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      Réviser
                    </Link>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Drafts Pending AI Analysis Section */}
        {pendingAnalysisCount > 0 && (
          <section className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl shadow-sm flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">
              cloud_sync
            </span>
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-bold">
                {pendingAnalysisCount} lot{pendingAnalysisCount > 1 ? 's' : ''} en attente d'analyse IA
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Vos photos et estimations sont sauvegardées localement. L'analyse IA débutera dès que votre téléphone sera connecté à Internet.
              </p>
            </div>
          </section>
        )}

        {/* Pending Offline Submissions Section */}
        {pendingCount > 0 && (
          <section className="bg-[#e8f5e9] border border-[#aef2be] p-4 rounded-xl shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[#1a5c35] ${isSyncing ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  cloud_sync
                </span>
                <span className="text-xs font-bold text-[#1a5c35]">
                  {pendingCount} récolte{pendingCount > 1 ? 's' : ''} en attente de synchronisation
                </span>
              </div>
              {isOnline && (
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="bg-[#004322] text-white py-1.5 px-3 rounded-lg text-[11px] font-bold active:scale-95 transition-transform cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <span className={`material-symbols-outlined text-xs ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                  {isSyncing ? 'En cours...' : 'Synchroniser'}
                </button>
              )}
            </div>

            <div className="space-y-2 pt-1">
              {queuedHarvests.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-lg border border-[#aef2be]/60 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#1a5c35]/10 flex items-center justify-center text-[#1a5c35] shrink-0">
                      {item.metadata.photoUrl ? (
                        <img alt={item.metadata.productName} className="w-full h-full object-cover" src={item.metadata.photoUrl} />
                      ) : (
                        <span className="material-symbols-outlined text-xl">agriculture</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0b1c30]">{item.metadata.productName}</p>
                      <p className="text-[10px] text-[#707970]">
                        {item.metadata.quantity} {item.metadata.unit} • {item.metadata.pricePerUnit.toLocaleString()} CDF/{item.metadata.unit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      {item.status === 'SYNCING' ? 'En cours' : 'En attente'}
                    </span>
                    <p className="text-[9px] text-[#707970] mt-0.5">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-on-surface-variant text-xs font-semibold">Lots approuvés</span>
              <span className="material-symbols-outlined text-primary">inventory_2</span>
            </div>
            <div className="text-2xl font-bold font-display text-primary">{activeCount}</div>
            <div className="text-[10px] font-semibold text-on-surface-variant mt-1">Disponibles pour la vente</div>
          </div>
          <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-on-surface-variant text-xs font-semibold">Stocks faibles</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold text-secondary font-display">
                {String(lowStockCount).padStart(2, '0')}
              </span>
              <span className="bg-secondary/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-secondary mb-1">AMBRE</span>
            </div>
          </div>
          <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-on-surface-variant text-xs font-semibold">Ruptures</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold text-error font-display">
                {String(outOfStockCount).padStart(2, '0')}
              </span>
              <span className="bg-error/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-error mb-1">ROUGE</span>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              placeholder="Rechercher un produit..."
              type="text"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {(['Tout', 'Céréales', 'Légumes', 'Fruits', 'Dattes', 'Laitier'] as Category[]).map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-white border border-outline-variant text-on-surface-variant hover:border-primary'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-sm font-bold">Inventaire groupé</h2>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="bg-white border border-outline-variant p-8 text-center text-outline rounded-xl text-sm">
              Aucun produit trouvé dans votre stock.
            </div>
          ) : (
            filteredGroups.map((group) => {
              const isExpanded = !!expandedGroups[group.id];
              return (
                <div key={group.id} className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                  {/* Header Card */}
                  <div
                    onClick={() => toggleGroup(group.id)}
                    className="p-4 flex gap-4 items-center cursor-pointer hover:bg-surface-container-low transition-colors"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-outline-variant/30">
                      <img alt={group.name} className="w-full h-full object-cover" src={group.imgUrl} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-sm text-on-surface truncate">{group.name}</h3>
                        <span className="bg-surface-container px-2 py-0.5 rounded text-[9px] font-bold text-on-surface-variant">
                          {group.category.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-on-surface-variant">
                          Stock total : <span className="text-on-surface font-bold">{group.totalStock} {group.unit}</span>
                        </span>
                        <span className="material-symbols-outlined text-on-surface-variant">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                      {/* Visual distributions */}
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden flex">
                          {group.distributions.map((dist, i) => (
                            <div
                              key={i}
                              className={`h-full ${dist.colorClass}`}
                              style={{ width: `${dist.percentage}%` }}
                              title={`${dist.name} — ${dist.percentage}%`}
                            ></div>
                          ))}
                        </div>
                        <div className="flex gap-3 text-[9px] font-semibold text-on-surface-variant overflow-x-auto scrollbar-none">
                          {group.distributions.map((dist, i) => (
                            <span key={i} className="flex items-center gap-1 shrink-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${dist.colorClass}`}></span> {dist.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-outline-variant bg-surface-container-low animate-fadeIn">
                      <div className="p-4 space-y-3">
                        {group.details.map((detail) => (
                          <div
                            key={detail.id}
                            className="bg-white p-3 rounded-lg border border-outline-variant/60 shadow-sm flex flex-col gap-2"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs">{detail.month}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  detail.status === 'APPROVED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : detail.status === 'PENDING_APPROVAL'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  {detail.status === 'APPROVED' ? 'Approuvé' : detail.status === 'PENDING_APPROVAL' ? 'En attente' : 'Rejeté'}
                                </span>
                                {detail.status === 'APPROVED' && (
                                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                                    Qualité : {detail.quality}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-on-surface-variant font-semibold">
                              <div className="flex gap-4">
                                <div>
                                  Stock : <span className="text-on-surface font-bold">{detail.stock}</span>
                                </div>
                                <div>
                                  Prix : <span className="text-on-surface font-bold">{detail.avgPrice}</span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Voulez-vous vraiment archiver ce lot ?')) {
                                    deleteHarvest(detail.id);
                                  }
                                }}
                                disabled={deletePending}
                                className="text-error hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                Archiver
                              </button>
                            </div>
                          </div>
                        ))}
                        <Link
                          to="/farmer/harvests/analyze"
                          className="w-full py-2 border-2 border-dashed border-primary text-primary rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors cursor-pointer text-center"
                        >
                          <span className="material-symbols-outlined text-sm">analytics</span>
                          Ajouter une récolte
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
