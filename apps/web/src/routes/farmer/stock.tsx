import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/stock')({
  component: StockPage,
});

type Category = 'Tout' | 'Céréales' | 'Légumes' | 'Fruits' | 'Engrais';

interface HarvestDetails {
  month: string;
  quality: number;
  stock: string;
  avgPrice: string;
  harvestsCount: number;
}

interface ProductGroup {
  id: string;
  name: string;
  category: string;
  totalStock: string;
  imgUrl: string;
  distributions: { name: string; percentage: number; colorClass: string }[];
  details: HarvestDetails[];
}

const PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'tomates-grappe',
    name: 'Tomates Grappe',
    category: 'Légumes',
    totalStock: '770 kg',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDse8VSUL0s9wZxCFkVNBACWkA9cI2CCzo62KPqgT_gTQmF6TTtqbbZeTv76RxV8chIRPSpK_FQ3zelQICkSw2sJU8KFtMn0B2eMICU6Tgld2S7VC4BxbZJ5LMQuVOO2hbhYUSZYXxDmyJVRqoPvyZ_UGGAuGm1MEnyzsNVMbSkLQ384gPdXxD1giybxDb0yyQzd1C5QBoM8Ejoa6FzZ4_W4tCa-FWw7phcz-HVsna4rJ7Frg1bnJ54HqKeMo3BFAe4Kwp8H_NUR9g',
    distributions: [
      { name: 'Jan', percentage: 15.5, colorClass: 'bg-primary' },
      { name: 'Mar', percentage: 32.5, colorClass: 'bg-surface-tint' },
      { name: 'Mai', percentage: 52, colorClass: 'bg-primary-container' },
    ],
    details: [
      { month: 'Novembre 2023', quality: 92, stock: '320kg', avgPrice: '2 500 FCFA/kg', harvestsCount: 2 },
      { month: 'Octobre 2023', quality: 89, stock: '450kg', avgPrice: '2 400 FCFA/kg', harvestsCount: 3 },
    ],
  },
  {
    id: 'ble-tendre',
    name: 'Blé Tendre',
    category: 'Céréales',
    totalStock: '15 t',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbKwDUmDdg6aRvgnuwHwxBHBWyu23GUntNZIIYnEpuMxQMDoflSGJIq56uhXmV4wYgZlZQfJKZ0IfO9cf6MNZeufUzJew3GQl8J0XSpHoeUxOCXk7cxd4eFQbzBNUOfwCtJbl04TpWcciZlNyrG7QvseGB5h0e9XWG6OqK7Sa8cYE1jMTnPlN7-JBsdT1tnIW_LQiMd5Q-H6VKxU6tNdFnRl5fCSDfuiSxqVYhw4gcjvmvI9e0mFCUuiCtGRwtqxR_3rzHEPFlm_E',
    distributions: [
      { name: 'Juil', percentage: 33.3, colorClass: 'bg-secondary' },
      { name: 'Août', percentage: 66.7, colorClass: 'bg-secondary-container' },
    ],
    details: [
      { month: 'Septembre 2023', quality: 75, stock: '15 t', avgPrice: '180 000 FCFA/t', harvestsCount: 1 },
    ],
  },
];

function StockPage() {
  const navigate = useNavigate();
  const [alertOpen, setAlertOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('Tout');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredGroups = PRODUCT_GROUPS.filter((group) => {
    const matchesCategory = activeCategory === 'Tout' || group.category === activeCategory;
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen pb-24 relative">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-outline-variant flex justify-between items-center px-4 h-16 max-w-[480px] left-1/2 -translate-x-1/2 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">agriculture</span>
          <h1 className="text-sm font-bold text-primary">Gestion des stocks</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Notifications')}
            className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant cursor-pointer"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-6">
        {/* Alert Banner */}
        {alertOpen && (
          <div className="bg-[#ffddbb] text-[#2b1700] flex items-center justify-between p-3.5 rounded-xl border border-[#ffa93d]/30 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined">warning</span>
              <span className="text-xs font-semibold">3 produits ont un stock faible</span>
            </div>
            <button
              onClick={() => setAlertOpen(false)}
              className="p-1 hover:bg-black/10 rounded-full cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link
            to="/farmer/harvests/new"
            className="flex-1 bg-primary text-white py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer text-center"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Ajouter un produit
          </Link>
          <button
            onClick={() => alert('Stock mis à jour')}
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
              <span className="text-on-surface-variant text-xs font-semibold">Produits actifs</span>
              <span className="material-symbols-outlined text-primary">inventory_2</span>
            </div>
            <div className="text-2xl font-bold font-display text-primary">42</div>
            <div className="text-[10px] font-semibold text-on-surface-variant mt-1">+4 cette semaine</div>
          </div>
          <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-on-surface-variant text-xs font-semibold">Stocks faibles</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold text-secondary font-display">03</span>
              <span className="bg-secondary/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-secondary mb-1">AMBRE</span>
            </div>
          </div>
          <div className="bg-white border border-outline-variant p-4 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-on-surface-variant text-xs font-semibold">Ruptures</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-xl font-bold text-error font-display">00</span>
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
            {(['Tout', 'Céréales', 'Légumes', 'Fruits', 'Engrais'] as Category[]).map((cat) => {
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
            <span className="text-[10px] font-bold text-on-surface-variant">Trier par: Produit</span>
          </div>

          {filteredGroups.map((group) => {
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
                        Stock total: <span className="text-on-surface font-bold">{group.totalStock}</span>
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
                      <div className="flex gap-3 text-[9px] font-semibold text-on-surface-variant">
                        {group.distributions.map((dist, i) => (
                          <span key={i} className="flex items-center gap-1">
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
                      {group.details.map((detail, idx) => (
                        <div
                          key={idx}
                          onClick={() => void navigate({ to: `/farmer/products/${group.id}` })}
                          className="bg-white p-3 rounded-lg border border-outline-variant/60 shadow-sm cursor-pointer hover:border-primary transition-all"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-xs">{detail.month}</span>
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                              {detail.quality}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-on-surface-variant font-semibold">
                            <div>
                              Stock: <span className="text-on-surface font-bold">{detail.stock}</span>
                            </div>
                            <div>
                              Prix moy: <span className="text-on-surface font-bold">{detail.avgPrice}</span>
                            </div>
                            <div>
                              Récoltes: <span className="text-on-surface font-bold">{detail.harvestsCount}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Link
                        to="/farmer/harvests/new"
                        className="w-full py-2 border-2 border-dashed border-primary text-primary rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/5 transition-colors cursor-pointer text-center"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Ajouter une récolte
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
          <span className="material-symbols-outlined">gavel</span>
          <span className="text-[10px] font-bold">Enchères</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          <span className="text-[10px] font-bold">Commandes</span>
        </Link>
        <Link
          to="/farmer/onboarding"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded-lg cursor-pointer"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
