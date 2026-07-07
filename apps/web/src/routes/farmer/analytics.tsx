import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/analytics')({
  component: FarmerAnalyticsPage,
});

type Period = 'Ce mois' | '3 mois' | '6 mois' | 'Cette année';

interface Stats {
  revenue: string;
  revenueVs: string;
  orders: number;
  ordersPending: number;
  topProduct: string;
  topProductQty: string;
  qualityScore: number;
  qualityLabel: string;
}

const statsByPeriod: Record<Period, Stats> = {
  'Ce mois': {
    revenue: '14,250.00 €',
    revenueVs: 'vs 12,660 € mois dernier',
    orders: 128,
    ordersPending: 2,
    topProduct: 'Pommes Gala',
    topProductQty: '2,450 kg vendus',
    qualityScore: 94.2,
    qualityLabel: 'Excellent',
  },
  '3 mois': {
    revenue: '38,610.00 €',
    revenueVs: 'vs 36,400 € trimestre dernier',
    orders: 347,
    ordersPending: 5,
    topProduct: 'Blé Tendre',
    topProductQty: '8,200 kg vendus',
    qualityScore: 93.8,
    qualityLabel: 'Très Bon',
  },
  '6 mois': {
    revenue: '72,120.00 €',
    revenueVs: 'vs 68,900 € sem. dernier',
    orders: 662,
    ordersPending: 8,
    topProduct: 'Pommes Gala',
    topProductQty: '12,800 kg vendus',
    qualityScore: 94.0,
    qualityLabel: 'Excellent',
  },
  'Cette année': {
    revenue: '154,200.00 €',
    revenueVs: 'vs 142,300 € année dernière',
    orders: 1424,
    ordersPending: 12,
    topProduct: 'Blé Tendre',
    topProductQty: '32,400 kg vendus',
    qualityScore: 94.5,
    qualityLabel: 'Excellent',
  },
};

function FarmerAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('Ce mois');
  const activeStats = statsByPeriod[period];

  return (
    <div className="bg-[#F7F8F5] text-[#0b1c30] min-h-screen font-sans">
      {/* Top App Bar */}
      <header className="w-full sticky top-0 z-40 bg-[#f8f9ff] border-b border-[#c0c9be] flex items-center justify-between px-4 h-16 max-w-full mx-auto">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-[#1a5c35] cursor-pointer">menu</span>
          <h1 className="text-[18px] font-bold text-[#1a5c35]">Analytiques &amp; revenus</h1>
        </div>
        <div className="flex items-center gap-3 text-[#404941]">
          <span className="material-symbols-outlined cursor-pointer">search</span>
          <span className="material-symbols-outlined text-[#1a5c35] cursor-pointer">account_circle</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:flex md:gap-6">
        {/* Navigation Drawer (Desktop Sidebar) */}
        <aside className="w-64 hidden md:flex flex-col shrink-0 p-4 border-r border-[#c0c9be] bg-[#e5eeff] rounded-xl self-start space-y-4">
          <nav className="space-y-2">
            <Link
              to="/farmer/dashboard"
              className="p-3 flex items-center gap-3 text-[#404941] hover:bg-[#d3e4fe] rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span className="text-[12px] font-semibold">Dashboard</span>
            </Link>
            <Link
              to="/farmer/stock"
              className="p-3 flex items-center gap-3 text-[#404941] hover:bg-[#d3e4fe] rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined">inventory_2</span>
              <span className="text-[12px] font-semibold">Inventory</span>
            </Link>
            <Link
              to="/farmer/analytics"
              className="p-3 flex items-center gap-3 bg-[#1a5c35] text-white rounded-lg font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined">analytics</span>
              <span className="text-[12px] font-semibold">Logistics</span>
            </Link>
            <Link
              to="/farmer/auctions"
              className="p-3 flex items-center gap-3 text-[#404941] hover:bg-[#d3e4fe] rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined">gavel</span>
              <span className="text-[12px] font-semibold">Auctions</span>
            </Link>
            <Link
              to="/farmer/profile"
              className="p-3 flex items-center gap-3 text-[#404941] hover:bg-[#d3e4fe] rounded-lg transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="text-[12px] font-semibold">Settings</span>
            </Link>
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-grow space-y-6">
          {/* Filter Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-[20px] font-semibold">Vue d'ensemble</h2>
            <div className="flex bg-white p-1 rounded-xl border border-[#c0c9be] w-fit shadow-sm">
              {(['Ce mois', '3 mois', '6 mois', 'Cette année'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                    period === p ? 'bg-[#1a5c35] text-white' : 'text-[#404941] hover:bg-[#d3e4fe]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Bento Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenus */}
            <div className="bg-white p-5 rounded-xl border border-[#c0c9be] shadow-sm transition-transform active:scale-95">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[#404941] text-[12px] font-semibold">Revenus</span>
                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  +12.5%
                </span>
              </div>
              <div className="text-2xl font-bold text-[#1a5c35]">{activeStats.revenue}</div>
              <div className="text-[11px] text-[#404941] mt-1">{activeStats.revenueVs}</div>
            </div>

            {/* Commandes */}
            <div className="bg-white p-5 rounded-xl border border-[#c0c9be] shadow-sm transition-transform active:scale-95">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[#404941] text-[12px] font-semibold">Commandes livrées</span>
                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  +4%
                </span>
              </div>
              <div className="text-2xl font-bold text-[#1a5c35]">{activeStats.orders}</div>
              <div className="text-[11px] text-[#404941] mt-1">
                {activeStats.ordersPending} commandes en attente
              </div>
            </div>

            {/* Produit Top */}
            <div className="bg-white p-5 rounded-xl border border-[#c0c9be] shadow-sm transition-transform active:scale-95">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[#404941] text-[12px] font-semibold">Produit top</span>
                <span
                  className="material-symbols-outlined text-[#ffa93d] text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  star
                </span>
              </div>
              <div className="text-lg font-bold text-[#1a5c35] truncate">{activeStats.topProduct}</div>
              <div className="text-[11px] text-[#404941] mt-1">{activeStats.topProductQty}</div>
            </div>

            {/* Score Qualité */}
            <div className="bg-white p-5 rounded-xl border border-[#c0c9be] shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[#404941] text-[12px] font-semibold block mb-1">Score Qualité</span>
                <div className="text-2xl font-bold text-[#1a5c35]">{activeStats.qualityScore}%</div>
                <div className="text-[11px] text-[#ffa93d] font-semibold">{activeStats.qualityLabel}</div>
              </div>
              <div className="relative w-12 h-12">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#c0c9be]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray="100, 100"
                    strokeWidth="3"
                  ></path>
                  <path
                    className="text-[#1a5c35]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${activeStats.qualityScore}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Revenue Chart Section */}
          <section className="bg-white p-6 rounded-xl border border-[#c0c9be] shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[18px] font-semibold text-[#1a5c35]">Évolution des revenus</h3>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#404941]">
                <span className="w-3 h-3 bg-[#1a5c35] rounded-full"></span>
                <span>Revenus Journaliers (€)</span>
              </div>
            </div>
            <div className="h-64 w-full relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: 'rgba(26, 92, 53, 0.2)' }}></stop>
                    <stop offset="100%" style={{ stopColor: 'rgba(26, 92, 53, 0)' }}></stop>
                  </linearGradient>
                </defs>
                <path d="M0,80 Q10,75 20,85 T40,60 T60,70 T80,40 T100,20 L100,100 L0,100 Z" fill="url(#chartGradient)"></path>
                <path
                  d="M0,80 Q10,75 20,85 T40,60 T60,70 T80,40 T100,20"
                  fill="none"
                  stroke="#1A5C35"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                ></path>
                <circle cx="80" cy="40" fill="#1A5C35" r="3" className="cursor-pointer"></circle>
                <circle cx="100" cy="20" fill="#1A5C35" r="3" className="cursor-pointer"></circle>
              </svg>
              <div className="flex justify-between mt-4 text-[10px] text-[#404941]">
                <span>1 Mai</span>
                <span>7 Mai</span>
                <span>14 Mai</span>
                <span>21 Mai</span>
                <span>28 Mai</span>
                <span>Hier</span>
              </div>
            </div>
          </section>

          {/* Double Columns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <section className="bg-white p-6 rounded-xl border border-[#c0c9be] shadow-sm">
              <h3 className="text-[18px] font-semibold text-[#1a5c35] mb-6">Meilleurs Produits</h3>
              <div className="space-y-5">
                {/* Product 1 */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0"
                    style={{
                      backgroundImage:
                        "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAyUcKeazPGSIYkaflm-EJNVC7s6vIuW_jIR7M9nyWiuPnjT4JVFNxyAs37M_pZ872E22XUG1_9zR_0HCDxPBHTJWJ5U3A9bz80xVvgCJOi0mLs1ie-aYTwEFPezeBO6fcerVjHP8BfEKP4sKBRaB1EekrTuNgEn_taIrRY9Beqtdrwnl0Roe7ceC0k89rpDi2V-Ev8EsoL6IzkOL-xUCN_l_MitIBCZsW28PfrzstdKJ-XMbzbWCHQLAEpo2gEHmuiTffnMdxc_oM')",
                    }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[14px] font-semibold text-[#0b1c30] truncate">Pommes Gala</span>
                      <span className="text-[14px] font-semibold text-[#1a5c35]">4,820 €</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#404941] mb-1.5">
                      <span>2,450 kg vendus</span>
                      <span>65% de l'objectif</span>
                    </div>
                    <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1a5c35] h-full w-[65%]"></div>
                    </div>
                  </div>
                </div>

                {/* Product 2 */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0"
                    style={{
                      backgroundImage:
                        "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDgdK_DZ9aVAAZtfrFzgaPazzd8kvsQUcNbuIDKLp78n0PdU1-GO0IWnP65slavfZ0yLL5Q8y0C9NfhcBiqzScEdK6EZdOpRmvYsdAxyK_t_R-gzDt4sytzHXZGaxaxWNBzvyxPur3c_-us5HYZMtsJBP3IOdKQjMpeezSop5pnSZwksXwdhe83VGEbSHPAGsDHHOgEFChmmWjrhsmhb9hRdBg7z1ghrOPatVFwbg_R_AeJQvfcJz1jVsVuvhq6X5olOL_ixZnUMNg')",
                    }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[14px] font-semibold text-[#0b1c30] truncate">Laitue Romaine</span>
                      <span className="text-[14px] font-semibold text-[#1a5c35]">3,140 €</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#404941] mb-1.5">
                      <span>1,200 unités vendues</span>
                      <span>42% de l'objectif</span>
                    </div>
                    <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1a5c35] h-full w-[42%]"></div>
                    </div>
                  </div>
                </div>

                {/* Product 3 */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg bg-cover bg-center shrink-0"
                    style={{
                      backgroundImage:
                        "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBFJ_xrL1iBCN9jsfBdxZTsi0wTRnMiavdMA_LFEhlKC14BVcf77fBbbcuMyWin_azwu8TbLfs0I3uejCMKN3bVWKxXAbxev-qUNQvqijRvDe1jKvhnU0gG88u7k6-d_ftkYvFv4-1JO3lykHCCWqmP9-e4Hi0dalLZHFSNGt6O7aT7W_5hGqcO1bBHGuGopHNkN6VhSjh2UH4OYb8eWLEYOlWVSNZQr7cKO2FxHMSeEairsctMpmZ84spSV0hoco8ORY40THKEw-Q')",
                    }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[14px] font-semibold text-[#0b1c30] truncate">Blé Tendre</span>
                      <span className="text-[14px] font-semibold text-[#1a5c35]">2,900 €</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-[#404941] mb-1.5">
                      <span>5,000 kg vendus</span>
                      <span>88% de l'objectif</span>
                    </div>
                    <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1a5c35] h-full w-[88%]"></div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => alert('Voir tout le catalogue')}
                className="w-full mt-6 py-2 text-[12px] font-semibold text-[#1a5c35] border border-[#1a5c35] rounded-lg hover:bg-[#1a5c35]/10 transition-colors cursor-pointer"
              >
                Voir tout le catalogue
              </button>
            </section>

            {/* Distribution Donut */}
            <section className="bg-white p-6 rounded-xl border border-[#c0c9be] shadow-sm flex flex-col">
              <h3 className="text-[18px] font-semibold text-[#1a5c35] mb-6">Répartition par catégorie</h3>
              <div className="flex-grow flex flex-col items-center justify-center">
                <div className="relative w-48 h-48 mb-6">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" fill="none" r="15.9" stroke="#e5e5e5" strokeWidth="4"></circle>
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="15.9"
                      stroke="#1A5C35"
                      strokeDasharray="45 100"
                      strokeDashoffset="25"
                      strokeWidth="4"
                    ></circle>
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="15.9"
                      stroke="#E8962A"
                      strokeDasharray="25 100"
                      strokeDashoffset="80"
                      strokeWidth="4"
                    ></circle>
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="15.9"
                      stroke="#4b5344"
                      strokeDasharray="20 100"
                      strokeDashoffset="5"
                      strokeWidth="4"
                    ></circle>
                    <circle
                      cx="18"
                      cy="18"
                      fill="none"
                      r="15.9"
                      stroke="#c0c9be"
                      strokeDasharray="10 100"
                      strokeDashoffset="15"
                      strokeWidth="4"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#1a5c35]">100%</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#404941] font-bold">Total</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#1A5C35]"></span>
                    <span className="text-[11px] font-semibold text-[#404941]">Légumes (45%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#E8962A]"></span>
                    <span className="text-[11px] font-semibold text-[#404941]">Fruits (25%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#4b5344]"></span>
                    <span className="text-[11px] font-semibold text-[#404941]">Céréales (20%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#c0c9be]"></span>
                    <span className="text-[11px] font-semibold text-[#404941]">Autres (10%)</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Monthly Summary Table */}
          <section className="bg-white rounded-xl border border-[#c0c9be] shadow-sm overflow-hidden mb-12">
            <div className="p-6 border-b border-[#c0c9be]">
              <h3 className="text-[18px] font-semibold text-[#1a5c35]">Récapitulatif Mensuel</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#eff4ff]">
                    <th className="px-6 py-4 text-[12px] font-semibold text-[#404941]">Mois</th>
                    <th className="px-6 py-4 text-[12px] font-semibold text-[#404941]">Commandes</th>
                    <th className="px-6 py-4 text-[12px] font-semibold text-[#404941]">Quantité (kg)</th>
                    <th className="px-6 py-4 text-[12px] font-semibold text-[#404941]">Revenus</th>
                    <th className="px-6 py-4 text-[12px] font-semibold text-[#404941]">Variation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c0c9be]">
                  {[
                    { month: 'Mai 2024', orders: 128, qty: '12,450', revenue: '14,250 €', diff: '+12%', green: true },
                    { month: 'Avril 2024', orders: 115, qty: '10,800', revenue: '12,660 €', diff: '+8%', green: true },
                    { month: 'Mars 2024', orders: 98, qty: '9,200', revenue: '11,700 €', diff: '-3%', green: false },
                    { month: 'Février 2024', orders: 104, qty: '10,100', revenue: '12,100 €', diff: '+5%', green: true },
                    { month: 'Janvier 2024', orders: 92, qty: '8,700', revenue: '11,500 €', diff: '-', green: null },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-white transition-colors">
                      <td className="px-6 py-4 text-[14px] font-semibold">{row.month}</td>
                      <td className="px-6 py-4 text-[14px] font-semibold">{row.orders}</td>
                      <td className="px-6 py-4 text-[14px] font-semibold">{row.qty}</td>
                      <td className="px-6 py-4 text-[14px] font-semibold text-[#1a5c35]">{row.revenue}</td>
                      <td
                        className={`px-6 py-4 font-bold text-[14px] ${
                          row.green === true ? 'text-green-600' : row.green === false ? 'text-[#ba1a1a]' : 'text-[#404941]'
                        }`}
                      >
                        {row.diff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Navigation Bar (Mobile only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-around items-center h-16 px-2 bg-[#f8f9ff] border-t border-[#c0c9be]">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-[#404941] active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[11px] font-semibold">Home</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-[#404941] active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined">package_2</span>
          <span className="text-[11px] font-semibold">Stock</span>
        </Link>
        <Link
          to="/farmer/analytics"
          className="flex flex-col items-center justify-center text-[#1A5C35] bg-[#1A5C35]/10 rounded-xl px-3 py-1 active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            analytics
          </span>
          <span className="text-[11px] font-semibold">Analytics</span>
        </Link>
        <Link
          to="/farmer/auctions"
          className="flex flex-col items-center justify-center text-[#404941] active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined">campaign</span>
          <span className="text-[11px] font-semibold">Bids</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-[#404941] active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[11px] font-semibold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
