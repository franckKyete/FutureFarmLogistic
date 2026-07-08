import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getFarmerHarvestsQuery, deleteHarvestMutation } from '@/features/harvests/api/harvests.queries';
import { addToast } from '@/features/shared/store/toast.store';

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
  const [activeCategory, setActiveCategory] = useState<Category>('Tout');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
      avgPrice: `${Number(h.pricePerUnit).toLocaleString()} FCFA/${h.unit}`,
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
    <div className="bg-surface text-on-surface font-sans min-h-screen pb-24 relative">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-outline-variant flex justify-between items-center px-4 h-16 max-w-[480px] left-1/2 -translate-x-1/2 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">agriculture</span>
          <h1 className="text-sm font-bold text-primary">Gestion des stocks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/notifications"
            className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant"
          >
            <span className="material-symbols-outlined">notifications</span>
          </Link>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-6">
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

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] flex justify-around items-center py-2 bg-white border-t border-outline-variant z-50 rounded-t-xl">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[10px] font-bold">Accueil</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-primary font-bold hover:bg-surface-container-low transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="text-[10px] font-bold">Produits</span>
        </Link>
        <Link
          to="/farmer/harvests/analyze"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">Analyses</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="text-[10px] font-bold">Commandes</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
