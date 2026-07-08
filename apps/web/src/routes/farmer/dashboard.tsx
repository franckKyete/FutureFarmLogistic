import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getFarmerHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { getSellerOrdersQuery } from '@/features/orders/api/orders.queries';
import { getFarmerProfileQuery } from '@/features/profile/api/profile.queries';

export const Route = createFileRoute('/farmer/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const [alertOpen, setAlertOpen] = useState(true);

  // Queries
  const { data: harvests } = useQuery(getFarmerHarvestsQuery());
  const { data: orders } = useQuery(getSellerOrdersQuery());
  const { data: profile } = useQuery(getFarmerProfileQuery());

  // Stats calculations
  const totalRevenue = orders
    ? orders
        .filter((o) => o.status === 'CONFIRMED' || o.status === 'DELIVERED')
        .reduce((sum, o) => sum + o.totalPrice, 0)
    : 0;

  const approvedHarvests = harvests ? harvests.filter((h) => h.status === 'APPROVED') : [];
  const averageQuality = approvedHarvests.length
    ? Math.round((approvedHarvests.reduce((sum, h) => sum + (h.qualityScore || 0), 0) / approvedHarvests.length) * 10)
    : 92; // default fallback metric if none

  const strokeDashoffset = 226.19 * (1 - averageQuality / 100);

  const activeListingsCount = harvests
    ? harvests.filter((h) => h.status === 'APPROVED' || h.status === 'PENDING_APPROVAL').length
    : 0;

  const pendingOrdersCount = orders ? orders.filter((o) => o.status === 'PENDING').length : 0;

  // Dynamic activity feed
  const activities = [
    ...(harvests || []).map((h) => ({
      id: h.id,
      title: `Lot #${h.id.slice(0, 4)} - ${h.product?.name || 'Produit'}`,
      description: h.status === 'APPROVED'
        ? 'Lot approuvé par l\'inspecteur'
        : h.status === 'PENDING_APPROVAL'
        ? 'Lot en attente d\'approbation'
        : 'Lot rejeté ou archivé',
      status: h.status === 'APPROVED' ? 'Actif' : h.status === 'PENDING_APPROVAL' ? 'En attente' : 'Inactif',
      statusColor: h.status === 'APPROVED' ? 'text-[#1A5C35]' : 'text-[#885200]',
      time: new Date(h.createdAt).toLocaleDateString(),
      image: h.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100',
    })),
    ...(orders || []).map((o) => ({
      id: o.id,
      title: `Commande #${o.id.slice(0, 4)}`,
      description: `Quantité : ${o.quantity} — Statut : ${o.status}`,
      status: 'Commande',
      statusColor: 'text-[#1a5c35]',
      time: new Date(o.createdAt).toLocaleDateString(),
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100',
    })),
  ]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 3);

  return (
    <div className="bg-background text-[#1C1C1C] min-h-screen pb-24 relative">
      {/* Alert Banner */}
      {alertOpen && harvests?.some((h) => h.status === 'REJECTED') && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-secondary-container text-on-secondary-container px-4 py-3 flex items-center gap-3 animate-pulse shadow-sm">
          <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <p className="text-xs font-semibold">
            Attention : Un de vos lots récoltés a été rejeté par l'inspecteur qualité.
          </p>
          <button
            onClick={() => setAlertOpen(false)}
            className="ml-auto material-symbols-outlined text-sm hover:opacity-80 cursor-pointer"
          >
            close
          </button>
        </div>
      )}

      {/* Top App Bar */}
      <header
        className={`fixed left-0 right-0 z-50 bg-white border-b border-[#E5E7EB] transition-all duration-300 ${
          alertOpen && harvests?.some((h) => h.status === 'REJECTED') ? 'top-12' : 'top-0'
        }`}
      >
        <div className="flex justify-between items-center h-16 px-4 max-w-[480px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden">
              <img
                alt={user?.firstName || 'Farmer'}
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGn2qT7QeTwtyfxgRosPmS-0nlUhtNydP7tpD9OEvVxH29WNqSqtWuVwNcqVu_hUb_yOBI53x1tTo1nkLvjpmNM0vUSZ92Hb9hPr3hWsRprzPYdcs_SYL-YuK1yl4dUcF9iO4SPv5sLazrYHxgoEaT72ro1fO99jzuShr5vtmd3qCkKaIiZAcNSahnL58pr1OULBwbh8LFZdHR6Wy3AvM9rygCGjRedCZBRdKoDGhmHZ0l1rd-Cj1dyzRn8FgRFA25wpp4Enzf5A4"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-sm font-bold text-on-surface">
                  {user?.firstName} {user?.lastName}
                </h1>
                <span
                  className="material-symbols-outlined text-[16px] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield_with_heart
                </span>
              </div>
              <p className="text-[10px] font-semibold text-outline">
                {profile?.companyName || 'Producteur Premium'}
              </p>
            </div>
          </div>
          <Link
            to="/notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer text-on-surface"
          >
            <span className="material-symbols-outlined">notifications</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`px-4 max-w-[480px] mx-auto space-y-6 transition-all duration-300 ${
          alertOpen && harvests?.some((h) => h.status === 'REJECTED') ? 'pt-32' : 'pt-20'
        }`}
      >
        {/* KPI Bento Grid */}
        <section className="grid grid-cols-2 gap-4">
          {/* Revenue Card */}
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex flex-col justify-between aspect-square shadow-sm">
            <span className="material-symbols-outlined text-[#885200] self-start">payments</span>
            <div>
              <p className="text-xs text-[#6B7280]">Revenu total</p>
              <p className="text-lg font-bold text-[#1C1C1C] tracking-tight">
                {totalRevenue.toLocaleString()} <span className="text-[10px] font-normal">FCFA</span>
              </p>
              <p className="text-[9px] text-[#6B7280] mt-1">Revenus cumulés confirmés</p>
            </div>
          </div>

          {/* Quality Gauge Card */}
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex flex-col items-center justify-center aspect-square text-center shadow-sm">
            <div className="relative w-20 h-20 mb-2">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" fill="transparent" r="36" stroke="#E5E7EB" strokeWidth="6"></circle>
                <circle
                  className="text-[#1A5C35]"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="36"
                  stroke="currentColor"
                  strokeDasharray="226.19"
                  strokeDashoffset={strokeDashoffset}
                  strokeWidth="6"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-[#1C1C1C]">{averageQuality}%</span>
              </div>
            </div>
            <p className="text-xs text-[#6B7280]">Score de qualité</p>
            <p className="text-[9px] text-[#6B7280] mt-1 leading-tight">Moyenne des scores de vos lots approuvés</p>
          </div>

          {/* Active Listings */}
          <Link to="/farmer/stock" className="bg-white border border-[#E5E7EB] p-4 rounded-xl shadow-sm block hover:border-[#1A5C35] transition-colors">
            <p className="text-xs text-[#6B7280] mb-1">Annonces actives</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-[#1C1C1C]">{activeListingsCount}</p>
            </div>
          </Link>

          {/* Pending Orders */}
          <Link to="/farmer/orders" className="bg-white border border-[#E5E7EB] p-4 rounded-xl shadow-sm block hover:border-[#ffa93d] transition-colors">
            <p className="text-xs text-[#6B7280] mb-1">Commandes en attente</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-[#1C1C1C]">{pendingOrdersCount}</p>
              {pendingOrdersCount > 0 && (
                <span className="text-[#885200] text-xs font-bold bg-[#ffa93d]/10 px-1.5 py-0.5 rounded-full">Nouveau</span>
              )}
            </div>
          </Link>
        </section>

        {/* Quick Actions Row */}
        <section className="flex justify-around items-center bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <Link to="/farmer/harvests/new" className="flex flex-col items-center gap-2 group cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-[#1A5C35] text-white flex items-center justify-center group-active:scale-95 transition-transform">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-xs font-semibold text-[#1C1C1C]">Ajouter</span>
          </Link>
          <Link to="/farmer/auctions/new" className="flex flex-col items-center gap-2 group cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-[#ffa93d] text-[#2b1700] flex items-center justify-center group-active:scale-95 transition-transform">
              <span className="material-symbols-outlined">gavel</span>
            </div>
            <span className="text-xs font-semibold text-[#1C1C1C]">Créer enchère</span>
          </Link>
          <Link to="/farmer/orders" className="flex flex-col items-center gap-2 group cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-[#4b5344] text-white flex items-center justify-center group-active:scale-95 transition-transform">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
            <span className="text-xs font-semibold text-[#1C1C1C]">Commandes</span>
          </Link>
        </section>

        {/* Activity Feed */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-on-surface">Activité récente</h2>
          </div>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="bg-white border border-[#E5E7EB] p-8 text-center text-outline rounded-xl text-sm">
                Aucune activité récente disponible.
              </div>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex items-center gap-4 shadow-sm">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <img
                      alt="Crop activity"
                      className="w-full h-full object-cover"
                      src={act.image}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1C1C1C] truncate">{act.title}</p>
                    <p className="text-xs text-[#6B7280] truncate">{act.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${act.statusColor}`}>{act.status}</p>
                    <p className="text-[10px] text-[#6B7280]">{act.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E7EB]">
        <div className="flex justify-around items-center h-16 px-2 max-w-[480px] mx-auto">
          <Link
            to="/farmer/dashboard"
            className="flex flex-col items-center justify-center text-[#1A5C35] font-bold active:scale-90 transition-transform duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              home
            </span>
            <span className="text-[10px] font-semibold">Accueil</span>
          </Link>
          <Link
            to="/farmer/stock"
            className="flex flex-col items-center justify-center text-[#6B7280] hover:text-[#1A5C35] active:scale-90 transition-transform duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined">grass</span>
            <span className="text-[10px] font-semibold">Produits</span>
          </Link>
          <Link
            to="/farmer/harvests/analyze"
            className="flex flex-col items-center justify-center text-[#6B7280] hover:text-[#1A5C35] active:scale-90 transition-transform duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined">analytics</span>
            <span className="text-[10px] font-semibold">Analyses</span>
          </Link>
          <Link
            to="/farmer/orders"
            className="flex flex-col items-center justify-center text-[#6B7280] hover:text-[#1A5C35] active:scale-90 transition-transform duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined">local_shipping</span>
            <span className="text-[10px] font-semibold">Commandes</span>
          </Link>
          <Link
            to="/farmer/profile"
            className="flex flex-col items-center justify-center text-[#6B7280] hover:text-[#1A5C35] active:scale-90 transition-transform duration-150 cursor-pointer"
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-semibold">Profil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
