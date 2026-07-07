import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { requireAuth } from '@/features/auth/utils/auth-guard';

export const Route = createFileRoute('/notifications')({
  beforeLoad: () => {
    requireAuth();
  },
  component: NotificationsCenterPage,
});

interface NotificationItem {
  id: string;
  category: 'Stocks' | 'Commandes' | 'Alertes IA' | 'Système';
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  actionText: string;
}

function NotificationsCenterPage() {
  const [activeFilter, setActiveFilter] = useState<'Toutes' | 'Stocks' | 'Commandes' | 'Alertes IA' | 'Système'>('Toutes');

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      category: 'Commandes',
      icon: 'shopping_cart',
      iconBg: 'bg-[#E8F5E9]',
      iconColor: 'text-[#2E7D32]',
      title: 'Nouvelle commande mangues',
      description: 'M. Dubois a commandé 50kg de mangues Kent pour livraison demain.',
      time: 'Il y a 1h',
      unread: true,
      actionText: 'Voir',
    },
    {
      id: '2',
      category: 'Stocks',
      icon: 'inventory_2',
      iconBg: 'bg-[#FFF8E1]',
      iconColor: 'text-[#F57F17]',
      title: 'Stock faible tomates',
      description: 'Le stock de tomates Roma est passé sous le seuil critique (15kg restants).',
      time: 'Il y a 2h',
      unread: true,
      actionText: 'Mettre à jour',
    },
    {
      id: '3',
      category: 'Alertes IA',
      icon: 'psychology',
      iconBg: 'bg-[#E3F2FD]',
      iconColor: 'text-[#1976D2]',
      title: 'Alerte IA prix',
      description: 'Prévision : Hausse des prix du maïs de 12% prévue la semaine prochaine.',
      time: 'Il y a 3h',
      unread: true,
      actionText: 'Analyser',
    },
    {
      id: '4',
      category: 'Stocks',
      icon: 'warning',
      iconBg: 'bg-[#FFEBEE]',
      iconColor: 'text-[#D32F2F]',
      title: 'Rupture maïs',
      description: 'Alerte : Le stock de maïs jaune est épuisé. Les enchères en cours sont suspendues.',
      time: 'Il y a 5h',
      unread: true,
      actionText: 'Réapprovisionner',
    },
    {
      id: '5',
      category: 'Système',
      icon: 'verified_user',
      iconBg: 'bg-[#eff4ff]',
      iconColor: 'text-[#404941]',
      title: 'Profil validé',
      description: 'Votre profil "Producteur Certifié" a été validé par l\'équipe administrative.',
      time: 'Hier, 14:20',
      unread: false,
      actionText: 'Détails',
    },
  ]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter((n) => n.unread).length;
  const filteredNotifications = notifications.filter(
    (n) => activeFilter === 'Toutes' || n.category === activeFilter
  );

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex justify-between items-center px-4 max-w-[480px] mx-auto left-0 right-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#004322] text-[24px]">agriculture</span>
          <h1 className="text-[18px] font-bold text-[#004322]">Future Farm</h1>
        </div>
        <button
          onClick={markAllAsRead}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#eff4ff] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[#404941]">notifications</span>
        </button>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto">
        {/* Notification Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold text-[#0b1c30]">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-[#1a5c35] text-white px-2 py-0.5 rounded-full text-[11px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={markAllAsRead}
            className="text-[#004322] text-[12px] font-bold hover:underline cursor-pointer"
          >
            Tout marquer comme lu
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-none">
          {(['Toutes', 'Stocks', 'Commandes', 'Alertes IA', 'Système'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeFilter === filter
                  ? 'bg-[#004322] text-white'
                  : 'bg-[#eff4ff] text-[#404941] hover:bg-[#dce9ff]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="space-y-6">
          <section>
            <h3 className="text-[12px] font-semibold tracking-wider text-[#404941] uppercase mb-3">
              Liste des notifications
            </h3>
            <div className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center text-[#404941]">
                  <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">
                    notifications_off
                  </span>
                  Aucune notification dans cette catégorie.
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markAsRead(n.id)}
                    className={`bg-white border border-[#c0c9be] rounded-xl p-4 flex gap-4 transition-all active:scale-[0.98] cursor-pointer ${
                      !n.unread ? 'opacity-80' : ''
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${n.iconBg} ${n.iconColor}`}
                    >
                      <span className="material-symbols-outlined">{n.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[14px] font-bold text-[#0b1c30] truncate">{n.title}</p>
                        {n.unread && <span className="w-2 h-2 rounded-full bg-[#1a5c35] mt-1.5 shrink-0"></span>}
                      </div>
                      <p className="text-[14px] text-[#404941] mb-3">{n.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#404941]">{n.time}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(n.id);
                            alert(`Action: ${n.actionText} sur "${n.title}"`);
                          }}
                          className="text-[#004322] text-[12px] font-bold hover:bg-[#1a5c35]/10 px-3 py-1 rounded-lg cursor-pointer"
                        >
                          {n.actionText}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] flex justify-around items-center py-2 bg-[#f8f9ff] border-t border-[#c0c9be] z-50 rounded-t-xl">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[12px] font-semibold">Accueil</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">inventory_2</span>
          <span className="text-[12px] font-semibold">Produits</span>
        </Link>
        <Link
          to="/farmer/auctions"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">gavel</span>
          <span className="text-[12px] font-semibold">Enchères</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">shopping_cart</span>
          <span className="text-[12px] font-semibold">Commandes</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-[#004322] font-bold hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            person
          </span>
          <span className="text-[12px] font-semibold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
