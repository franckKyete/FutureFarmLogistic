import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/farmer/auctions/$id/bidders')({
  component: AuctionBiddersPage,
});

interface Bidder {
  name: string;
  quantity: string;
  price: string;
  status: 'Bought' | 'Active' | 'Waiting';
  isUser?: boolean;
}

interface Activity {
  id: string;
  icon: string;
  color: string;
  text: string;
  time: string;
}

function AuctionBiddersPage() {
  const { id } = Route.useParams();

  // Simulated countdown timer (starts at 4 minutes 22 seconds = 262 seconds)
  const [secondsLeft, setSecondsLeft] = useState(262);
  // Chart heights state
  const [heights, setHeights] = useState([40, 55, 45, 70, 60, 85, 95]);
  // Live price
  const [livePrice, setLivePrice] = useState(342.5);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    const chartInterval = setInterval(() => {
      setHeights((prev) =>
        prev.map((h, i) => {
          if (i === prev.length - 1) return h; // Keep the active/highest bar at 95% or close
          return Math.floor(Math.random() * 60) + 20;
        })
      );
      // Randomly fluctuate price slightly
      setLivePrice((prev) => Number((prev + (Math.random() - 0.5) * 2).toFixed(2)));
    }, 3000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(chartInterval);
    };
  }, []);

  const formatTimer = (totalSeconds: number) => {
    if (totalSeconds <= 0) return 'ENDED';
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const bidders: Bidder[] = [
    {
      name: 'Acheteur_01',
      quantity: '250 Tons',
      price: '€341.00',
      status: 'Bought',
    },
    {
      name: 'Acheteur_02',
      quantity: '100 Tons',
      price: `€${livePrice.toFixed(2)}`,
      status: 'Active',
      isUser: true,
    },
    {
      name: 'Acheteur_03',
      quantity: '500 Tons',
      price: '€338.00',
      status: 'Waiting',
    },
    {
      name: 'Acheteur_04',
      quantity: '150 Tons',
      price: '€340.50',
      status: 'Bought',
    },
  ];

  const activities: Activity[] = [
    {
      id: '1',
      icon: 'check',
      color: 'bg-[#004322]',
      text: 'Acheteur_01 locked 250T at €341.00',
      time: '2 mins ago',
    },
    {
      id: '2',
      icon: 'trending_up',
      color: 'bg-[#ffa93d]',
      text: `New highest bid by Acheteur_02: €${livePrice.toFixed(2)}`,
      time: 'Just now',
    },
    {
      id: '3',
      icon: 'group_add',
      color: 'bg-[#d3e4fe] text-[#004322]',
      text: 'Acheteur_12 joined the auction',
      time: '5 mins ago',
    },
  ];

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex flex-col items-center font-sans">
      {/* TopAppBar Shell */}
      <header className="w-full top-0 sticky z-40 bg-[#f8f9ff] border-b border-[#c0c9be] flex items-center justify-between px-4 py-3 max-w-[480px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.history.back()}
            className="material-symbols-outlined text-[#004322] active:scale-95 transition-transform cursor-pointer"
          >
            arrow_back
          </button>
          <h1 className="text-[18px] font-semibold text-[#004322] truncate max-w-[200px]">
            {id === '8829' ? 'Premium Organic Corn' : 'Organic Durum Wheat'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[11px] text-[#404941]">Live Price</span>
            <span className="block text-[18px] font-semibold text-[#885200]">
              €{livePrice.toFixed(2)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full border border-[#c0c9be] overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt="Profil"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCPyts3YJrXp8Y97dqqSzOSKRRoJgZRd04yVJGLegQQC20eI1VROSNboAbB_f3DgB5BeBBSAVidmZ_wCyks9M-_6hne8giPDyo-YJuaWxdjZhIujYkfc5TrZkZqpPCT4BaVaNh7CSy2cipbekISh1b8QYepKnsMk-kpJNp4JP60Sh9I7FJ-Fq_1aS8WYsUIcggzCpv3P8mD5V6zcmerNk7Jy7Xgf50nQ-v99p9lcXkjnXGVVF6ooFYzPR55e542eCOYufzuUON5hSU"
            />
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="w-full flex-1 max-w-[480px] pb-24 px-4 space-y-6 pt-4">
        {/* Price Evolution Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-[#004322]">Price Evolution</h2>
            <div className="flex items-center gap-1 text-[#885200] font-semibold text-[12px]">
              <span className="material-symbols-outlined text-sm">timer</span>
              <span>Ends in {formatTimer(secondsLeft)}</span>
            </div>
          </div>
          {/* Chart Card */}
          <div className="bg-white border border-[#c0c9be] rounded-xl p-3 h-48 flex items-end justify-between gap-1 relative overflow-hidden">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-20 pointer-events-none">
              <div className="border-t border-[#707970] w-full"></div>
              <div className="border-t border-[#707970] w-full"></div>
              <div className="border-t border-[#707970] w-full"></div>
            </div>
            {/* Bars */}
            {heights.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-sm transition-all duration-500 ${
                  i === heights.length - 1
                    ? 'bg-[#ffa93d] shadow-[0_0_10px_rgba(255,169,61,0.4)] animate-pulse'
                    : 'bg-[#1a5c35]/20'
                }`}
                style={{ height: `${h}%` }}
              ></div>
            ))}
            <div className="absolute bottom-2 right-2 text-[11px] text-[#404941] bg-white/80 backdrop-blur px-2 py-0.5 rounded border border-[#c0c9be]">
              Real-time Vol: 1.2k t
            </div>
          </div>
        </section>

        {/* Bidders List Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-[#004322]">Active Bidders</h2>
            <span className="text-[12px] text-[#404941] font-semibold">12 Participants</span>
          </div>
          <div className="space-y-2">
            {bidders.map((bidder, idx) => (
              <div
                key={idx}
                className={`bg-white border border-[#c0c9be] rounded-xl p-4 flex items-center justify-between transition-colors ${
                  bidder.isUser ? 'border-l-4 border-l-[#ffa93d]' : 'hover:border-[#004322]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      bidder.isUser ? 'bg-[#ffddbb]' : 'bg-[#d3e4fe]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined ${
                        bidder.isUser ? 'text-[#885200]' : 'text-[#004322]'
                      }`}
                    >
                      {bidder.isUser ? 'shield_person' : 'person'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#0b1c30]">
                      {bidder.name}{' '}
                      {bidder.isUser && <span className="text-[#ffa93d] text-xs ml-1">(You)</span>}
                    </p>
                    <p className="text-[11px] text-[#404941]">
                      {bidder.quantity} @ {bidder.price}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-[12px] font-semibold ${
                      bidder.status === 'Bought'
                        ? 'bg-[#004322]/10 text-[#004322]'
                        : bidder.status === 'Active'
                          ? 'bg-[#ffa93d]/20 text-[#6d4100]'
                          : 'bg-[#c0c9be] text-[#404941]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        bidder.status === 'Bought'
                          ? 'bg-[#004322]'
                          : bidder.status === 'Active'
                            ? 'bg-[#ffa93d] animate-pulse'
                            : 'bg-[#707970]'
                      }`}
                    ></span>
                    {bidder.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Activity Feed */}
        <section className="space-y-3">
          <h2 className="text-[18px] font-semibold text-[#004322]">Recent Activity</h2>
          <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[0.5px] before:bg-[#c0c9be]">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-4 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center z-10 text-white text-[14px] ${act.color}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{act.icon}</span>
                </div>
                <div className="flex-grow pt-1">
                  <p className="text-[14px] text-[#0b1c30]">{act.text}</p>
                  <span className="text-[11px] text-[#404941]">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Fixed Action Footer */}
      <div className="fixed bottom-0 w-full max-w-[480px] bg-white/90 backdrop-blur-md border-t border-[#c0c9be] p-4 flex gap-3 z-50">
        <button
          onClick={() => alert('Modification de votre offre')}
          className="flex-1 py-4 px-6 bg-white border border-[#004322] text-[#004322] font-bold rounded-xl active:scale-95 transition-transform cursor-pointer"
        >
          Modify Bid
        </button>
        <button
          onClick={() => alert('Achat immédiat effectué !')}
          className="flex-[2] py-4 px-6 bg-[#004322] text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          Buy Now
        </button>
      </div>
    </div>
  );
}
