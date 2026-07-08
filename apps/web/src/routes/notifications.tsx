import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  getMyNotificationsQuery,
  markNotificationReadMutation,
  markAllNotificationsReadMutation,
} from '@/features/notifications/api/notifications.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { NotificationStatus } from '@futurefarm/types';

export const Route = createFileRoute('/notifications')({
  beforeLoad: () => {
    requireAuth();
  },
  component: NotificationsCenterPage,
});

type NotificationTab = 'Toutes' | 'Non lues' | 'Lues';

function NotificationsCenterPage() {
  const [activeFilter, setActiveFilter] = useState<NotificationTab>('Non lues');

  // Queries
  const { data: paginatedData, refetch } = useQuery(getMyNotificationsQuery({ limit: 100 }));
  const notifications = paginatedData?.data || [];

  // Mutations
  const markRead = useMutation({
    ...markNotificationReadMutation(),
    onSuccess: () => {
      void refetch();
    },
  });

  const markAllRead = useMutation({
    ...markAllNotificationsReadMutation(),
    onSuccess: () => {
      addToast('Toutes les notifications ont été marquées comme lues.', 'success');
      void refetch();
    },
  });

  const unreadCount = notifications.filter((n) => n.status !== NotificationStatus.READ).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'Non lues') {
      return n.status !== NotificationStatus.READ;
    }
    if (activeFilter === 'Lues') {
      return n.status === NotificationStatus.READ;
    }
    return true;
  });

  const getIconConfig = (title: string, priority: string) => {
    const lowerTitle = title.toLowerCase();
    if (priority === 'high') {
      return { icon: 'warning', bg: 'bg-[#FFEBEE]', color: 'text-[#D32F2F]' };
    }
    if (lowerTitle.includes('commande') || lowerTitle.includes('achat')) {
      return { icon: 'shopping_cart', bg: 'bg-[#E8F5E9]', color: 'text-[#2E7D32]' };
    }
    if (lowerTitle.includes('enchère') || lowerTitle.includes('prix')) {
      return { icon: 'gavel', bg: 'bg-[#E3F2FD]', color: 'text-[#1976D2]' };
    }
    if (lowerTitle.includes('stock') || lowerTitle.includes('récolte')) {
      return { icon: 'inventory_2', bg: 'bg-[#FFF8E1]', color: 'text-[#F57F17]' };
    }
    return { icon: 'notifications', bg: 'bg-[#eff4ff]', color: 'text-[#404941]' };
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8f9ff] border-b border-[#c0c9be] h-16 flex justify-between items-center px-4 max-w-[480px] mx-auto left-0 right-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/farmer/dashboard" className="material-symbols-outlined text-[#004322] cursor-pointer">
            arrow_back
          </Link>
          <h1 className="text-[18px] font-bold text-[#004322]">Notifications</h1>
        </div>
        <button
          onClick={() => void refetch()}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#eff4ff] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[#404941]">refresh</span>
        </button>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto">
        {/* Notification Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-semibold text-[#0b1c30]">Centre d'alertes</h2>
            {unreadCount > 0 && (
              <span className="bg-[#1a5c35] text-white px-2 py-0.5 rounded-full text-[11px] font-bold animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-[#004322] text-[12px] font-bold hover:underline cursor-pointer disabled:opacity-50"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-none">
          {(['Toutes', 'Non lues', 'Lues'] as NotificationTab[]).map((filter) => (
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
            <div className="space-y-3">
              {filteredNotifications.length === 0 ? (
                <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center text-[#404941]">
                  <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">
                    notifications_off
                  </span>
                  Aucune notification trouvée.
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const isUnread = n.status !== NotificationStatus.READ;
                  const config = getIconConfig(n.title, n.priority);

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (isUnread) {
                          markRead.mutate(n.id);
                        }
                      }}
                      className={`bg-white border border-[#c0c9be] rounded-xl p-4 flex gap-4 transition-all active:scale-[0.98] cursor-pointer ${
                        !isUnread ? 'opacity-70' : 'border-l-4 border-l-[#1a5c35]'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bg} ${config.color}`}
                      >
                        <span className="material-symbols-outlined text-sm">{config.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[13px] font-bold text-[#0b1c30] truncate">{n.title}</p>
                          {isUnread && <span className="w-2 h-2 rounded-full bg-[#1a5c35] mt-1.5 shrink-0 animate-ping"></span>}
                        </div>
                        <p className="text-[12px] text-[#404941] leading-relaxed mb-2">{n.body}</p>
                        <div className="flex items-center justify-between text-[10px] text-[#707970]">
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                          {isUnread && (
                            <span className="text-primary font-bold hover:underline">Marquer comme lu</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
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
          <span className="material-symbols-outlined text-[24px]">grass</span>
          <span className="text-[12px] font-semibold">Stock</span>
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
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-95 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[24px]">person</span>
          <span className="text-[12px] font-semibold">Profil</span>
        </Link>
      </nav>
    </div>
  );
}
