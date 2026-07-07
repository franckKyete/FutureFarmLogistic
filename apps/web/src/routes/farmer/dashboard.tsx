import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const [alertOpen, setAlertOpen] = useState(true);

  return (
    <div className="bg-background text-[#1C1C1C] min-h-screen pb-24 relative">
      {/* Alert Banner */}
      {alertOpen && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-secondary-container text-on-secondary-container px-4 py-3 flex items-center gap-3 animate-pulse shadow-sm">
          <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
            warning
          </span>
          <p className="text-xs font-semibold">
            Alerte qualité IA : Votre annonce 'Oignons doux' nécessite une révision.
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
          alertOpen ? 'top-12' : 'top-0'
        }`}
      >
        <div className="flex justify-between items-center h-16 px-4 max-w-[480px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-outline-variant overflow-hidden">
              <img
                alt="Mamadou Kone"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCGn2qT7QeTwtyfxgRosPmS-0nlUhtNydP7tpD9OEvVxH29WNqSqtWuVwNcqVu_hUb_yOBI53x1tTo1nkLvjpmNM0vUSZ92Hb9hPr3hWsRprzPYdcs_SYL-YuK1yl4dUcF9iO4SPv5sLazrYHxgoEaT72ro1fO99jzuShr5vtmd3qCkKaIiZAcNSahnL58pr1OULBwbh8LFZdHR6Wy3AvM9rygCGjRedCZBRdKoDGhmHZ0l1rd-Cj1dyzRn8FgRFA25wpp4Enzf5A4"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-sm font-bold text-on-surface">Mamadou Kone</h1>
                <span
                  className="material-symbols-outlined text-[16px] text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield_with_heart
                </span>
              </div>
              <p className="text-[10px] font-semibold text-outline">Producteur Premium</p>
            </div>
          </div>
          <button
            onClick={() => alert('Notifications')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors cursor-pointer text-on-surface"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`px-4 max-w-[480px] mx-auto space-y-6 transition-all duration-300 ${
          alertOpen ? 'pt-32' : 'pt-20'
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
                1.2M <span className="text-[10px] font-normal">FCFA</span>
              </p>
              <p className="text-[9px] text-[#6B7280] mt-1">Revenus du mois en cours</p>
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
                  strokeDashoffset="18.1"
                  strokeWidth="6"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-[#1C1C1C]">92%</span>
              </div>
            </div>
            <p className="text-xs text-[#6B7280]">Score de qualité</p>
            <p className="text-[9px] text-[#6B7280] mt-1 leading-tight">Score qualité moyen de vos produits actifs</p>
          </div>

          {/* Active Listings */}
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl shadow-sm">
            <p className="text-xs text-[#6B7280] mb-1">Annonces actives</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-[#1C1C1C]">14</p>
              <span className="text-[#1A5C35] text-xs font-bold">↑ 2</span>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl shadow-sm">
            <p className="text-xs text-[#6B7280] mb-1">Commandes en attente</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-[#1C1C1C]">08</p>
              <span className="text-[#885200] text-xs font-bold bg-[#ffa93d]/10 px-1.5 py-0.5 rounded-full">Nouveau</span>
            </div>
          </div>
        </section>

        {/* Quick Actions Row */}
        <section className="flex justify-around items-center bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <Link to="/farmer/harvests/new" className="flex flex-col items-center gap-2 group cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-[#1A5C35] text-white flex items-center justify-center group-active:scale-95 transition-transform">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-xs font-semibold text-[#1C1C1C]">Ajouter</span>
          </Link>
          <button
            onClick={() => alert("Création d'enchère")}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#ffa93d] text-[#2b1700] flex items-center justify-center group-active:scale-95 transition-transform">
              <span className="material-symbols-outlined">gavel</span>
            </div>
            <span className="text-xs font-semibold text-[#1C1C1C]">Créer enchère</span>
          </button>
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
            <button
              onClick={() => alert('Voir tout')}
              className="text-primary font-semibold text-xs hover:underline cursor-pointer"
            >
              Voir tout
            </button>
          </div>
          <div className="space-y-3">
            {/* Activity Item 1 */}
            <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img
                  alt="Tomatoes"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbkmBD6mmrZ9Dc5uwiwPSr-dmB5av8Gr6v8GTMp9hOYX4W4gGpZO1TnEKbmiH9pFhG2da5u4GFIVzcSQE_oSuQQbKJovgP61hEkHJvAt4tNqTIhB6cBx4znvdPvcXqjtseYv5yVbhZoD8Hv419miQqMW0ub8gU-5f5rU3SGFfQUEwo44aH_SDbHf1sq4hmoZC_a2Y7RM6huwbtPhrGBspA3rq34_Qsh589Uf9929Ix0EYlDjVoSvZNYudpMa1ufiUD4ocvBERTUX8"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1C1C1C]">Lot #204 - Tomates</p>
                <p className="text-xs text-[#6B7280]">Commande récupérée par le centre logistique</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[#1A5C35]">Actif</p>
                <p className="text-[10px] text-[#6B7280]">Il y a 2m</p>
              </div>
            </div>

            {/* Activity Item 2 */}
            <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img
                  alt="Maize"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAX2oKdD-jsPjRnjVAau1Nz1GSj59oOaatKyG8QnjV7lM9upAd7kFWDNLhGQK7YsC7vyiBFAqa8SnsoNj6fiAr5y2AB75O_Kl0XsXwcSvKXp_DS51Lf-enrEs1OSW6c29IIVWBPzJUgnb4LX_OB4Kee3EZIPZfdVZ--7P2_1Z_lQ4qZuw0URNCWZ7qxa1C9tWO-EzqUgBlIAz591oJmMGB6CAK7xC45A4joGV3RhJwG_bLYLrQzIEy_9x4xv89vHUTT-fJ4ooNjj8w"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1C1C1C]">Enchère Maïs Blanc</p>
                <p className="text-xs text-[#6B7280]">Nouvelle offre : 45 000 FCFA</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[#885200]">Offre</p>
                <p className="text-[10px] text-[#6B7280]">Il y a 15m</p>
              </div>
            </div>

            {/* Activity Item 3 */}
            <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex items-center gap-4 border-l-4 border-l-[#ffa93d] shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-[#ffa93d]/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#885200]">warning</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1C1C1C]">Action requise</p>
                <p className="text-xs text-[#6B7280]">Oignons doux : Télécharger cert. qualité</p>
              </div>
              <div className="text-right">
                <button
                  onClick={() => alert("Résolution de l'alerte")}
                  className="bg-[#ffa93d] text-[#2b1700] hover:bg-[#ffa93d]/90 px-3 py-1 rounded-full text-xs font-bold cursor-pointer"
                >
                  Régler
                </button>
              </div>
            </div>
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
            <span className="material-symbols-outlined">gavel</span>
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
            to="/farmer/onboarding"
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
