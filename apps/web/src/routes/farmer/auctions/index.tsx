import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/farmer/auctions/')({
  component: MyAuctionsPage,
});

interface AuctionItem {
  id: string;
  title: string;
  lotNumber: string;
  quantity: string;
  image: string;
  status: 'Live' | 'Upcoming' | 'Finished' | 'Drafts';
  biddersCount: number;
  currentPrice: number;
  initialSeconds: number;
  timerLabel: string;
  upcomingDate?: string;
  notifyRequests?: number;
}

function MyAuctionsPage() {
  const [activeTab, setActiveTab] = useState<'Live' | 'Upcoming' | 'Finished' | 'Drafts'>('Live');

  // Timer states
  const [timer1, setTimer1] = useState(9918);
  const [timer2, setTimer2] = useState(29564);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer1((prev) => (prev > 0 ? prev - 1 : 0));
      setTimer2((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSeconds = (totalSeconds: number) => {
    if (totalSeconds <= 0) return 'ENDED';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const auctions: AuctionItem[] = [
    {
      id: '8829',
      title: 'Premium Organic Corn',
      lotNumber: 'Lot #8829',
      quantity: '50 Tons',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWFXSpqzloanA41KY5Sx8q646c52xcf1Ka4jUMSVbO8r2Sef1M87v3MgaPvUsxDlxnbMqSAW0ZRXYGzhcerz1PWuBL14v76WbncX8Mow_Gz5RFKB4kO7bjco7u9WdKLsxFdLybPHKn6T_dBq6h37b-q5I2oAuk4P595NKO7dH-pB6ECJApN9GSiIr9PeEO2SfEyUJDBozZL25jC4jGAR8MHQxUlW5sfIuCopOuh44uVDLR_dGI5V1UPIceQk7GFhMT5gKBBTDhTDQ',
      status: 'Live',
      biddersCount: 14,
      currentPrice: 24500.0,
      initialSeconds: timer1,
      timerLabel: 'Ends Soon',
    },
    {
      id: '9102',
      title: 'Grade-A Coffee Beans',
      lotNumber: 'Lot #9102',
      quantity: '12 Tons',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0svhAb5e2Gq8hMplMzBGFZiBcn5GY28dCgWRHQcC5sngMTAmYWP3dNxpncaLREytHhhjpo3hEJLQGKhaKFly_QlFdQvnLCC3L3V4WY8OkYSTABTQg_vSPt1Wt9Jy8VjO-8EMJT22Y2lbmyrsh4sz6XbFmqi3OoskGdA2PODPbwV-z9VLAzMszJErQTQocL1yBNP0gDSFYaSBZOwo4IqSmabKYHFjbhLbITTgHeI9qXcC47bphIxZDzAv2xXcXrL7jXUzKGPROXus',
      status: 'Live',
      biddersCount: 8,
      currentPrice: 18200.0,
      initialSeconds: timer2,
      timerLabel: 'Trending',
    },
    {
      id: '1024',
      title: 'Winter Wheat Harvest',
      lotNumber: 'Lot #1024',
      quantity: '30 Tons',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9U6RRMhKDSq3Dxu5IXfJlhQFAIMUQkQIvqoq0EhHr5orBixt0-UwC-izhww9YEjCxOQdwBeaj69cLxzpbQDQtMB8Ugly_Obwmr0aAzZTYBW9XNFg4CrI5qZQKnknborlc3Wv5qxOgnKp_wFnbVdPS1XwtQEZVd_YWlFu7Y6NmbecFolg6HGoWk3BKw-_m7L90Mr5VSOqKqBBlMikAL93HTPmpm5XvrgahF3wDQIWQQ8I9k3OXo7wtdBQh632yJ5aeQHUsWtd_m4I',
      status: 'Upcoming',
      biddersCount: 0,
      currentPrice: 15000.0,
      initialSeconds: 0,
      timerLabel: 'Starts soon',
      upcomingDate: 'May 24',
      notifyRequests: 112,
    },
    {
      id: '7721',
      title: 'Organic Potatoes (Cat. B)',
      lotNumber: 'Lot #7721',
      quantity: '20 Tons',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbkmBD6mmrZ9Dc5uwiwPSr-dmB5av8Gr6v8GTMp9hOYX4W4gGpZO1TnEKbmiH9pFhG2da5u4GFIVzcSQE_oSuQQbKJovgP61hEkHJvAt4tNqTIhB6cBx4znvdPvcXqjtseYv5yVbhZoD8Hv419miQqMW0ub8gU-5f5rU3SGFfQUEwo44aH_SDbHf1sq4hmoZC_a2Y7RM6huwbtPhrGBspA3rq34_Qsh589Uf9929Ix0EYlDjVoSvZNYudpMa1ufiUD4ocvBERTUX8',
      status: 'Finished',
      biddersCount: 18,
      currentPrice: 9800.0,
      initialSeconds: 0,
      timerLabel: 'Ended',
    },
    {
      id: '3301',
      title: 'Fresh Sweet Onions',
      lotNumber: 'Lot #3301',
      quantity: '10 Tons',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCqcYokBM5kQDRESOGkXflLJGS8Sfhmhl2RUSLQEJ3jPOcYJzIQjRzLJTQyhpuxdZ7eBFdoos92T56naFbdHUU3MjEkDtSerTrLCnPdQlNOV0BH3JMoOyhCqdhnkORNueI3kVfyvVV0sWckjTF4Xfk1RtcXEdq5IbxKy1ZnkXIUZKKU68XLKWWKb0mVi0UjPCjGhfkmMMRTFpsKzhy0_4Fpkr5abtTkudJGxd-S5qcJmkISEbOTY3Ymfmg0dRQGkrwxJHoO3ImtaJs',
      status: 'Drafts',
      biddersCount: 0,
      currentPrice: 4200.0,
      initialSeconds: 0,
      timerLabel: 'Draft',
    },
  ];

  const filteredAuctions = auctions.filter((item) => item.status === activeTab);

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-24 font-sans">
      {/* Top AppBar */}
      <header className="w-full top-0 sticky z-40 bg-[#f8f9ff] border-b border-[#c0c9be] flex items-center justify-between px-4 py-3 max-w-[480px] mx-auto">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[#004322]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            agriculture
          </span>
          <h1 className="text-[20px] font-bold text-[#004322]">Future Farm</h1>
        </div>
        <div className="w-10 h-10 rounded-full border border-[#c0c9be] overflow-hidden">
          <img
            className="w-full h-full object-cover"
            alt="Profil"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeNI3sOswbUKmPlkOrK8gV322J6ktYGcHdm7rpAa0dcvYE3HDUusPPqrAMWg36oHwOMB_VnmOSDIp20pJcqOd3zc-yBPpPM8aikzoXfNZqxKx6aXIcQPUlpd-Y2xhz1UVA3y7leEex4ApuyP4VPD2HbAlw7vk2R3nLDccQ9ixUJcR6BwiKxvOHqydaWa-0WGFk0fK5LpAVXLB3FL88dXK62kkXoXqMFqfj_NRsTMSKAorJYpZjBSme2bT4A6fJZf-ViR-gMyrh3ow"
          />
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-4 pt-4">
        {/* Screen Title & Filters */}
        <div className="mb-4">
          <h2 className="text-[32px] font-semibold mb-3 text-[#0b1c30]">My Auctions</h2>
          {/* Horizontal Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {(['Live', 'Upcoming', 'Finished', 'Drafts'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-full font-semibold text-[12px] whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#004322] text-white active:scale-95'
                    : 'bg-[#dce9ff] text-[#404941] hover:bg-[#d3e4fe]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Auction List Container */}
        <div className="flex flex-col gap-4">
          {filteredAuctions.length === 0 ? (
            <div className="bg-white border border-[#c0c9be] rounded-xl p-8 text-center text-[#404941]">
              <span className="material-symbols-outlined text-[48px] text-[#707970] mb-2 block">gavel</span>
              Aucune enchère dans cette catégorie.
            </div>
          ) : (
            filteredAuctions.map((item) => {
              if (item.status === 'Live') {
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#c0c9be] rounded-xl overflow-hidden flex flex-col transition-all active:scale-[0.98]"
                  >
                    {/* Image Header */}
                    <div className="relative h-48 w-full">
                      <img className="w-full h-full object-cover" alt={item.title} src={item.image} />
                      {/* Status Badge */}
                      <div className="absolute top-3 left-3 bg-[#885200] px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white"></span>
                        <span className="text-white font-semibold text-[12px] tracking-wider uppercase">LIVE</span>
                      </div>
                      {/* Bidder Count */}
                      <div className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-white">groups</span>
                        <span className="text-white font-semibold text-[12px]">{item.biddersCount} Bidders</span>
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-[18px] font-semibold text-[#0b1c30]">{item.title}</h3>
                          <p className="text-[#404941] text-[14px]">{item.lotNumber} • {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#404941] text-[12px] font-semibold">Current Price</p>
                          <p className="text-[#004322] text-[18px] font-semibold">${item.currentPrice.toLocaleString()}</p>
                        </div>
                      </div>
                      {/* Timer Bar */}
                      <div className="bg-[#e5eeff] rounded-lg p-3 flex items-center justify-between border border-[#c0c9be]/30">
                        <div className="flex items-center gap-2 text-[#885200]">
                          <span className="material-symbols-outlined text-[20px]">timer</span>
                          <span className="text-[18px] font-semibold">
                            {formatSeconds(item.id === '8829' ? timer1 : timer2)}
                          </span>
                        </div>
                        <span className="text-[#404941] text-[12px] font-semibold uppercase">{item.timerLabel}</span>
                      </div>
                      <Link
                        to="/farmer/auctions/$id/bidders"
                        params={{ id: item.id }}
                        className="w-full py-3 bg-[#004322] text-white rounded-lg text-[12px] font-bold uppercase tracking-widest transition-colors hover:bg-[#004322]/90 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        View Bidders
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </Link>
                    </div>
                  </div>
                );
              } else {
                // Upcoming / Finished / Draft cards
                return (
                  <div
                    key={item.id}
                    className="bg-[#eff4ff] border border-[#c0c9be] rounded-xl p-4 flex gap-4 items-center border-dashed opacity-90"
                  >
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#d3e4fe]">
                      <img className="w-full h-full object-cover" alt={item.title} src={item.image} />
                    </div>
                    <div className="flex-grow">
                      <span className="text-[#404941] text-[11px] font-bold uppercase">
                        {item.status} {item.upcomingDate ? `• ${item.upcomingDate}` : ''}
                      </span>
                      <h4 className="text-[18px] font-semibold text-[#0b1c30]">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="material-symbols-outlined text-[16px] text-[#404941]">
                          {item.status === 'Finished' ? 'check_circle' : 'notifications_active'}
                        </span>
                        <span className="text-[#404941] text-[14px]">
                          {item.status === 'Finished' ? 'Enchère terminée' : `${item.notifyRequests ?? 0} Notify Requests`}
                        </span>
                      </div>
                    </div>
                    {item.status === 'Upcoming' && (
                      <Link
                        to="/farmer/auctions/$id/bidders"
                        params={{ id: item.id }}
                        className="material-symbols-outlined text-[#004322] p-2 bg-white rounded-full border border-[#c0c9be] active:scale-90 transition-transform cursor-pointer"
                      >
                        chevron_right
                      </Link>
                    )}
                  </div>
                );
              }
            })
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f8f9ff] border-t border-[#c0c9be] flex justify-around items-center h-16 max-w-[480px] mx-auto px-2">
        <Link
          to="/farmer/dashboard"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-[12px] font-semibold">Home</span>
        </Link>
        <Link
          to="/farmer/stock"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">storefront</span>
          <span className="text-[12px] font-semibold">Products</span>
        </Link>
        <Link
          to="/farmer/auctions"
          className="flex flex-col items-center justify-center text-[#004322] font-bold hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            gavel
          </span>
          <span className="text-[12px] font-semibold">Auctions</span>
        </Link>
        <Link
          to="/farmer/orders"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="text-[12px] font-semibold">Orders</span>
        </Link>
        <Link
          to="/farmer/profile"
          className="flex flex-col items-center justify-center text-[#404941] hover:bg-[#eff4ff] transition-colors px-4 py-2 rounded-xl active:scale-90 duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[12px] font-semibold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
