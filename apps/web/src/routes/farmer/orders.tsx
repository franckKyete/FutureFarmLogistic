import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/orders')({
  component: OrdersPage,
});

type OrderStatus = 'En attente' | 'Confirmée' | 'En transit' | 'Livrée' | 'Annulée';

interface OrderItem {
  id: string;
  productName: string;
  buyerName: string;
  location: string;
  status: OrderStatus;
  weight: string;
  price: string;
  imgUrl: string;
}

const ORDERS: OrderItem[] = [
  {
    id: '#ORD-8842',
    productName: 'Tomates Grappe',
    buyerName: 'Mamadou K.',
    location: 'Dakar',
    status: 'En attente',
    weight: '500 kg',
    price: '125,000 FCFA',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBCAE_nzITmoo_otb4EvGEQ839gSzR9q1Q8dwaizlt5Aim7YEiYgewgc3MGI_xmAW6D33yKZXUVnvFfpoLVzvA0AgkW4DTjA7RTdgKmlYt4eeMR8FLDIVNeFRmHoy5T4Nz5NMBMq4aMgD5kL1VHAd7M7ioTyxlYOGA-ywaIdp4iajO7YESANjJin0CVxXQ3I6zIORBFys9dFPVbOwj1ujkyFF49ASYkgHr2H81N2drfqow3wYAwTW4NtvPxCxDPlz2psygcrXN5OK0',
  },
  {
    id: '#ORD-8839',
    productName: 'Mangues Kent (Export)',
    buyerName: 'Awa N.',
    location: 'Saint-Louis',
    status: 'En transit',
    weight: '1,200 kg',
    price: '840,000 FCFA',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX1IMV7DMNQSMSJgfoZsyKqlw0EXkfMKDTTendV6xTf07zyZfbi1NIdWA2TBB6m5UT4TzlPMQdmQJYURYRWalR8rVP0gd3vSmPQgE8blTjZP7zKybb7bpRPtyeDUXk5o_A4v8EAdi-icxxdt4F2Ptf3g7s8BXndU_dxgUamOZi2GIRXuJtOJm2RzqeihhlppPzAtjBfmf1Gj7nIY3x-h--Mx3dEGVby3Zt6umMv1ow6ZMDhZ-Z6Lgw8z8r8KdxJN37NXjomfTbS7E',
  },
  {
    id: '#ORD-8835',
    productName: 'Oignons Blancs',
    buyerName: 'Hotel Terrou-Bi',
    location: 'Dakar',
    status: 'Livrée',
    weight: '250 kg',
    price: '87,500 FCFA',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC3tdd7eFCemf18K0l3s1LzeTVoe1o6UzguZdl1fpVNb6CednswZ7FEbAHYfZPeSKOlP6FbOMC3ZSHH7-DY5o7ZKkTONrdrpK7WxvdmtBonk256bZUm9ftlojdZE7R1-FV59_b0x73Hx0yzmfetwcgKn-tzdcNVIXL_TdLRr3Pb1yzl8Gch2uDCs2vOraeJ0bhxCPgRjFIsuAEmYDjHYIY2b-S7Su-dq6wXYb78S0OUpozfYq5-p1W1r2efnCIFPho25xPTb9PHBw',
  },
  {
    id: '#ORD-8831',
    productName: 'Poivrons Verts',
    buyerName: 'Samba D.',
    location: 'Touba',
    status: 'En attente',
    weight: '100 kg',
    price: '45,000 FCFA',
    imgUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXu9Sg-XbRDEucEijJbs_5YL1s8FTxLjd6LWAsD4D8PtRecIkJtbUMYjfu4DIEQN1Ezpv6JkssjowREOIIWGwGcwa0aEAk8fMDl1WTU4RLvZjxrGuy_zq3IaZm6t744W0jru6UfAMkOhxQd1k0A3eR5BSPx-PFgfi8GVy3stHLms-mu4FSBQ9HpI4kzJpaXJmK201W7XFdxHH9je2rm2giuFPAxXJX2yx_aLqWmCYJy2diOTM9dFWYdf9fZ0J6i0M-UKHNtpY5C6Piw',
  },
];

function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'Toutes' | OrderStatus>('Toutes');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

  const filteredOrders = ORDERS.filter((order) => {
    const matchesFilter = activeFilter === 'Toutes' || order.status === activeFilter;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-background relative pb-24 font-sans text-on-surface">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white border-b border-outline-variant max-w-[480px] mx-auto">
        <div className="flex justify-between items-center px-4 h-16 w-full shadow-sm">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-primary cursor-pointer">menu</span>
            <h1 className="text-sm font-bold text-primary">Mes commandes</h1>
          </div>
          <div className="flex items-center">
            <span
              onClick={() => alert('Notifications')}
              className="material-symbols-outlined text-on-surface-variant cursor-pointer p-2 rounded-full hover:bg-surface-container-low transition-colors"
            >
              notifications
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-20 px-4 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total commandes</p>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-primary leading-none">128</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">En attente</p>
              <span className="bg-[#ffa93d]/20 text-[#885200] text-[9px] px-1.5 py-0.5 rounded font-bold">URGENT</span>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-secondary leading-none">14</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">En transit</p>
              <span className="bg-surface-container-highest text-primary text-[9px] px-1.5 py-0.5 rounded font-bold">SUIVI</span>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-primary leading-none">32</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-outline-variant flex flex-col justify-between min-h-[100px] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Livrées (Mois)</p>
              <span className="bg-[#aef2be] text-primary text-[9px] px-1.5 py-0.5 rounded font-bold">OBJECTIF</span>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-2xl font-bold font-display text-primary leading-none">82</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-outline-variant rounded-xl py-3 pl-11 pr-4 text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/40"
            placeholder="Numéro commande, acheteur..."
            type="text"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
          {(['Toutes', 'En attente', 'Confirmée', 'En transit', 'Livrée', 'Annulée'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-primary text-white font-bold'
                    : 'bg-white border border-outline-variant text-on-surface-variant hover:border-primary'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Vertical Order List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusColor =
              order.status === 'En attente'
                ? 'bg-[#ffa93d]/20 text-[#885200]'
                : order.status === 'En transit'
                  ? 'bg-primary/10 text-primary'
                  : order.status === 'Livrée'
                    ? 'bg-[#aef2be]/30 text-primary opacity-60'
                    : 'bg-outline-variant/30 text-on-surface-variant';

            return (
              <div key={order.id} className="bg-white rounded-xl p-4 border border-outline-variant space-y-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-primary font-bold text-sm">{order.id}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>{order.status}</span>
                </div>
                <div className="flex items-center gap-4">
                  <img className="w-10 h-10 rounded-lg object-cover bg-surface-container-low border border-outline-variant/30" alt={order.productName} src={order.imgUrl} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold truncate text-[#1C1C1C]">{order.productName}</h3>
                    <p className="text-xs text-on-surface-variant truncate">
                      {order.buyerName}, {order.location}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-outline-variant/30">
                  <div className="flex gap-4 items-center">
                    <span className="text-xs text-on-surface-variant">{order.weight}</span>
                    <span className="text-sm font-bold text-on-surface">{order.price}</span>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    Détails
                  </button>
                </div>
              </div>
            );
          })}
          {filteredOrders.length === 0 && (
            <p className="text-center text-xs text-on-surface-variant py-8 font-semibold">
              Aucune commande ne correspond à votre recherche.
            </p>
          )}
        </div>
      </main>

      {/* Details Modal Overlay */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 text-on-surface shadow-2xl relative">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
            <h3 className="font-display text-base font-bold text-primary">Détails de la commande {selectedOrder.id}</h3>
            <div className="flex items-center gap-4 border-b border-outline-variant/30 pb-4">
              <img className="w-12 h-12 rounded-lg object-cover" alt={selectedOrder.productName} src={selectedOrder.imgUrl} />
              <div>
                <h4 className="font-bold text-sm">{selectedOrder.productName}</h4>
                <p className="text-xs text-on-surface-variant">Statut: <span className="font-bold text-primary">{selectedOrder.status}</span></p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Acheteur:</span>
                <span className="font-bold">{selectedOrder.buyerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Destination:</span>
                <span className="font-bold">{selectedOrder.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Quantité commandée:</span>
                <span className="font-bold">{selectedOrder.weight}</span>
              </div>
              <div className="flex justify-between border-t border-outline-variant/30 pt-2 text-sm">
                <span className="font-bold text-primary">Montant total:</span>
                <span className="font-black text-primary">{selectedOrder.price}</span>
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  alert('Commande validée !');
                  setSelectedOrder(null);
                }}
                className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 active:scale-95 cursor-pointer"
              >
                Confirmer l'expédition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 bg-white border-t border-outline-variant max-w-[480px] mx-auto shadow-lg">
        <div className="flex justify-around items-center h-16 w-full">
          <Link
            to="/farmer/dashboard"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">home</span>
            <span className="text-[10px] font-bold">Accueil</span>
          </Link>
          <Link
            to="/farmer/stock"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="text-[10px] font-bold">Stock</span>
          </Link>
          <Link
            to="/farmer/harvests/analyze"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">gavel</span>
            <span className="text-[10px] font-bold">Enchères</span>
          </Link>
          <Link
            to="/farmer/orders"
            className="flex flex-col items-center justify-center text-primary font-bold transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              shopping_cart
            </span>
            <span className="text-[10px] font-bold">Commandes</span>
          </Link>
          <Link
            to="/farmer/onboarding"
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">person</span>
            <span className="text-[10px] font-bold">Profil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
