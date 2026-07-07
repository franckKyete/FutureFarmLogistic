import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/farmer/auctions/new')({
  component: DutchAuctionNewPage,
});

function DutchAuctionNewPage() {
  const navigate = useNavigate();

  // State Management
  const [quantity, setQuantity] = useState<number>(500);
  const [startPrice, setStartPrice] = useState<number>(3500);
  const [reservePrice, setReservePrice] = useState<number>(2800);
  const [decrementAmount, setDecrementAmount] = useState<number>(50);
  const [frequency, setFrequency] = useState<string>('3 min');
  const [startTime, setStartTime] = useState<string>('2023-11-25T08:00');
  const [duration, setDuration] = useState<string>('2h');

  // Available stocks
  const maxStock = 1200;
  const remainingStock = maxStock - quantity;

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-40 relative font-sans">
      {/* Header / TopAppBar */}
      <header className="bg-[#f8f9ff] fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 max-w-[480px] mx-auto border-b border-[#c0c9be]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="material-symbols-outlined text-[#004322] active:scale-95 duration-100 cursor-pointer"
          >
            arrow_back
          </button>
          <h1 className="text-[18px] font-semibold text-[#004322] truncate">Créer une enchère</h1>
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-[#c0c9be]">
          <img
            className="w-full h-full object-cover"
            alt="Profil"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqcYokBM5kQDRESOGkXflLJGS8Sfhmhl2RUSLQEJ3jPOcYJzIQjRzLJTQyhpuxdZ7eBFdoos92T56naFbdHUU3MjEkDtSerTrLCnPdQlNOV0BH3JMoOyhCqdhnkORNueI3kVfyvVV0sWckjTF4Xfk1RtcXEdq5IbxKy1ZnkXIUZKKU68XLKWWKb0mVi0UjPCjGhfkmMMRTFpsKzhy0_4Fpkr5abtTkudJGxd-S5qcJmkISEbOTY3Ymfmg0dRQGkrwxJHoO3ImtaJs"
          />
        </div>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-6">
        {/* Intro Section */}
        <section className="space-y-2">
          <h2 className="text-[20px] font-semibold text-[#0b1c30]">Enchère Hollandaise</h2>
          <p className="text-[14px] text-[#404941]">Le prix diminue automatiquement jusqu'à trouver un acheteur.</p>
        </section>

        {/* Form: 1. Produit */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold tracking-wider text-[#707970] uppercase">1. Produit</span>
            <button className="text-[#004322] text-[12px] font-semibold hover:underline">Modifier</button>
          </div>
          <div className="bg-[#ffffff] border border-[#c0c9be] rounded-xl p-4 flex gap-4">
            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-[#c0c9be]">
              <img
                className="w-full h-full object-cover"
                alt="Gombo"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHX73pv2B-itFOJfav6izmqLF31NU2C76vGGYtMfocCx2G7Dvo61lSGY2hMe-YZUjcBB3Aur0XCBTInOkThH49Xk3ipvd1tYb26ChdIu6QEQA6Eto0R02YGMwZ-zccuc7zzZJr1Csz33BEtuJ1iwMmn2n47i8y4arcgupP7hx_x_2jJ-yvV3Trv9K2OMLxv5ygtMPRwzztg2bTWqXDXhcwIqcL4mSZ8nohZVtbqzGRl7ZZsWDyEUu5g52qgxx5GMVtIV39E3fcXY4"
              />
            </div>
            <div className="flex flex-col justify-center">
              <h3 className="text-[18px] font-semibold text-[#0b1c30]">Gombo frais (Cat. A)</h3>
              <p className="text-[14px] text-[#404941]">Stock disponible : {maxStock} kg</p>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#aef2be] text-[#0b522c] text-[11px] font-bold self-start">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Qualité IA : 94%
              </div>
            </div>
          </div>
        </section>

        {/* Form: 2. Lot */}
        <section className="space-y-4">
          <label className="text-[12px] font-semibold tracking-wider text-[#707970] uppercase block">
            2. Lot de vente
          </label>
          <div className="relative">
            <input
              className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-4 text-[16px]"
              placeholder="Quantité"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#404941]">kg</span>
          </div>
          <div className="flex items-center gap-2 p-3 bg-[#ffddbb] text-[#673d00] rounded-lg border border-[#ffa93d]">
            <span className="material-symbols-outlined">info</span>
            <p className="text-[14px]">
              {remainingStock >= 0 ? (
                `Attention : il restera ${remainingStock} kg en stock après cette mise en enchère.`
              ) : (
                <span className="text-[#ba1a1a] font-semibold">Erreur: la quantité dépasse le stock disponible.</span>
              )}
            </p>
          </div>
        </section>

        {/* Form: 3. Prix */}
        <section className="space-y-4">
          <label className="text-[12px] font-semibold tracking-wider text-[#707970] uppercase block">
            3. Tarification
          </label>
          <div className="space-y-2">
            <label className="text-[14px] text-[#404941]">Prix de départ (FCFA/kg)</label>
            <input
              className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-4 text-[32px] font-semibold text-[#004322]"
              type="number"
              value={startPrice}
              onChange={(e) => setStartPrice(Number(e.target.value))}
            />
            <p className="text-[#1a5c35] text-[12px] font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              Prix suggéré par l'IA : 3 200 FCFA/kg
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[14px] text-[#404941]">Prix de réserve (minimum)</label>
            <input
              className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-4 text-[16px]"
              type="number"
              value={reservePrice}
              onChange={(e) => setReservePrice(Number(e.target.value))}
            />
            <p className="text-[#404941] text-[14px] italic">
              L'enchère s'arrête si personne n'achète avant d'atteindre ce prix.
            </p>
          </div>
        </section>

        {/* Form: 4. Décrémentation */}
        <section className="space-y-4">
          <label className="text-[12px] font-semibold tracking-wider text-[#707970] uppercase block">
            4. Paramètres de baisse
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] text-[#404941]">Montant de la baisse</label>
              <div className="relative">
                <input
                  className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px]"
                  type="number"
                  value={decrementAmount}
                  onChange={(e) => setDecrementAmount(Number(e.target.value))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#707970]">FCFA</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] text-[#404941]">Fréquence de baisse</label>
              <select
                className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px]"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="1 min">1 min</option>
                <option value="3 min">3 min</option>
                <option value="5 min">5 min</option>
                <option value="10 min">10 min</option>
              </select>
            </div>
          </div>
        </section>

        {/* Form: 5. Durée */}
        <section className="space-y-4">
          <label className="text-[12px] font-semibold tracking-wider text-[#707970] uppercase block">
            5. Planification
          </label>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#707970]">calendar_today</span>
              <input
                className="flex-1 bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-[14px]"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['1h', '2h', '4h', '8h', '24h'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-full border transition-colors text-[12px] font-semibold cursor-pointer ${
                    duration === d
                      ? 'border-[#004322] bg-[#aef2be] text-[#0b522c] font-bold'
                      : 'border-[#c0c9be] text-[#0b1c30] hover:bg-[#eff4ff]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-[14px] text-[#404941] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">event_available</span>
              Fin de l'enchère : Aujourd'hui à 10:00 (durée: {duration})
            </p>
          </div>
        </section>

        {/* Section de Prévisualisation */}
        <section className="bg-[#ffddbb]/30 border-2 border-dashed border-[#ffa93d] rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-[#6d4100]">
            <span className="material-symbols-outlined">visibility</span>
            <span className="text-[18px] font-semibold">Aperçu de votre enchère</span>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-[18px] font-semibold text-[#0b1c30]">Gombo frais (Cat. A)</h4>
                <p className="text-[12px] text-[#707970]">Lot de {quantity} kg</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-[#ffdad6] text-[#93000a] text-[11px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">timer</span>
                Baisse imminente
              </div>
            </div>
            <div className="text-center py-4">
              <span className="text-[14px] text-[#404941]">Prix actuel</span>
              <div className="text-[48px] font-bold text-[#885200] leading-tight tabular-nums">
                {startPrice.toLocaleString()}
              </div>
              <span className="text-[18px] font-semibold text-[#885200]">FCFA/kg</span>
            </div>

            {/* Step Graph Simulation */}
            <div className="h-24 w-full relative overflow-hidden rounded-lg bg-[#eff4ff] border border-[#c0c9be]">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: 'linear-gradient(to bottom right, transparent 49%, #E8962A 50%, #E8962A 51%, transparent 52%)',
                  backgroundSize: '40px 40px',
                }}
              ></div>
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
                {/* Reserve Price Line */}
                <line stroke="#ba1a1a" strokeDasharray="4" strokeWidth="1" x1="0" x2="400" y1="70" y2="70"></line>
                <text fill="#ba1a1a" fontSize="8" x="5" y="65">
                  Prix de réserve ({reservePrice})
                </text>
                {/* Staircase Price Line */}
                <path
                  d="M0,20 L40,20 L40,30 L80,30 L80,40 L120,40 L120,50 L160,50 L160,60 L200,60 L200,70"
                  fill="none"
                  stroke="#885200"
                  strokeWidth="3"
                ></path>
                {/* Animated Point */}
                <circle cx="20" cy="20" fill="#885200" r="4">
                  <animate attributeName="opacity" dur="1.5s" repeatCount="indefinite" values="1;0;1"></animate>
                </circle>
              </svg>
            </div>
            <div className="bg-[#dce9ff] rounded-lg p-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#885200]">trending_down</span>
              <p className="text-[14px] text-[#0b1c30]">
                Dans <strong>{frequency}</strong>, le prix sera de{' '}
                <strong>{(startPrice - decrementAmount).toLocaleString()} FCFA/kg</strong> si aucun acheteur ne se
                manifeste.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Fixed Footer Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#f8f9ff] border-t border-[#c0c9be] px-4 py-4 max-w-[480px] mx-auto flex gap-3">
        <button
          onClick={() => {
            alert('Enchère sauvegardée en brouillon !');
            void navigate({ to: '/farmer/dashboard' });
          }}
          className="flex-1 py-4 px-2 border border-[#707970] rounded-xl text-[18px] font-semibold text-[#404941] hover:bg-[#eff4ff] active:scale-95 transition-all cursor-pointer"
        >
          Brouillon
        </button>
        <button
          onClick={() => {
            alert('Enchère lancée avec succès !');
            void navigate({ to: '/farmer/dashboard' });
          }}
          className="flex-[2] py-4 px-2 bg-[#004322] text-white rounded-xl text-[18px] font-semibold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Lancer l'enchère
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </nav>
    </div>
  );
}
