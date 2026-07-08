import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getFarmerHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { createAuctionMutation } from '@/features/auctions/api/auctions.queries';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/farmer/auctions/new')({
  component: DutchAuctionNewPage,
});

function DutchAuctionNewPage() {
  const navigate = useNavigate();

  // Queries
  const { data: harvests } = useQuery(getFarmerHarvestsQuery());
  const approvedHarvests = harvests ? harvests.filter((h) => h.status === 'APPROVED') : [];

  // Form states
  const [selectedHarvestId, setSelectedHarvestId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [decrementAmount, setDecrementAmount] = useState('');
  const [frequencyMinutes, setFrequencyMinutes] = useState('3');
  const [startTime, setStartTime] = useState(new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)); // 5 mins from now
  const [durationHours, setDurationHours] = useState('2');

  const selectedHarvest = approvedHarvests.find((h) => h.id === selectedHarvestId);
  const maxStock = selectedHarvest ? Number(selectedHarvest.quantityInStock) : 0;
  const remainingStock = maxStock - Number(quantity);

  // Mutation
  const { mutate: createAuction, isPending } = useMutation({
    ...createAuctionMutation(),
    onSuccess: () => {
      addToast('Enchère hollandaise créée avec succès !', 'success');
      void navigate({ to: '/farmer/auctions' });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHarvestId) {
      addToast('Veuillez sélectionner un lot de récolte.', 'warning');
      return;
    }
    if (Number(quantity) <= 0 || Number(quantity) > maxStock) {
      addToast('Quantité invalide ou supérieure au stock.', 'warning');
      return;
    }
    if (Number(reservePrice) >= Number(startPrice)) {
      addToast('Le prix de réserve doit être inférieur au prix de départ.', 'warning');
      return;
    }

    const startAtDate = new Date(startTime);
    const endAtDate = new Date(startAtDate.getTime() + Number(durationHours) * 60 * 60 * 1000);

    createAuction({
      harvestId: selectedHarvestId,
      startingPrice: Number(startPrice),
      reservePrice: Number(reservePrice),
      priceDecrementAmount: Number(decrementAmount),
      priceDecrementIntervalMinutes: Number(frequencyMinutes),
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      quantityOnOffer: Number(quantity),
    });
  };

  return (
    <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen pb-40 relative font-sans">
      {/* Header / TopAppBar */}
      <header className="bg-[#f8f9ff] fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-16 max-w-[480px] mx-auto border-b border-[#c0c9be] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate({ to: '/farmer/auctions' })}
            className="material-symbols-outlined text-[#004322] active:scale-95 duration-100 cursor-pointer"
          >
            arrow_back
          </button>
          <h1 className="text-[18px] font-semibold text-[#004322] truncate">Créer une enchère</h1>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-[480px] mx-auto space-y-6">
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Intro Section */}
          <section className="space-y-1">
            <h2 className="text-[20px] font-semibold text-[#0b1c30]">Enchère Hollandaise</h2>
            <p className="text-[12px] text-[#404941]">Le prix diminue automatiquement jusqu'à trouver un acheteur.</p>
          </section>

          {/* Harvest batch select */}
          <section className="space-y-2">
            <label className="text-[11px] font-semibold tracking-wider text-[#707970] uppercase block">
              1. Sélectionner un lot approuvé
            </label>
            <select
              value={selectedHarvestId}
              onChange={(e) => {
                setSelectedHarvestId(e.target.value);
                const h = approvedHarvests.find((item) => item.id === e.target.value);
                if (h) {
                  setQuantity(String(h.quantityInStock));
                  setStartPrice(String(h.pricePerUnit));
                  setReservePrice(String(Math.round(h.pricePerUnit * 0.75)));
                  setDecrementAmount(String(Math.round(h.pricePerUnit * 0.05)));
                }
              }}
              className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-sm outline-none"
              required
            >
              <option value="">-- Choisir un lot récolté --</option>
              {approvedHarvests.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.product?.name} (Lot #{h.id.slice(0, 4)}) — {h.quantityInStock} {h.unit} dispo
                </option>
              ))}
            </select>
          </section>

          {selectedHarvest && (
            <>
              {/* Form: 2. Lot */}
              <section className="space-y-2 animate-fadeIn">
                <label className="text-[11px] font-semibold tracking-wider text-[#707970] uppercase block">
                  2. Quantité mise en vente
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-sm outline-none"
                    placeholder="Quantité"
                    type="number"
                    min="1"
                    max={maxStock}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#404941]">
                    {selectedHarvest.unit}
                  </span>
                </div>
                {remainingStock >= 0 ? (
                  <p className="text-xs text-[#404941] italic">
                    Il restera {remainingStock} {selectedHarvest.unit} en stock.
                  </p>
                ) : (
                  <p className="text-xs text-error font-bold">La quantité dépasse le stock disponible.</p>
                )}
              </section>

              {/* Form: 3. Prix */}
              <section className="space-y-4 animate-fadeIn">
                <label className="text-[11px] font-semibold tracking-wider text-[#707970] uppercase block">
                  3. Tarification
                </label>
                <div className="space-y-1">
                  <label className="text-xs text-[#404941]">Prix de départ (FCFA / {selectedHarvest.unit})</label>
                  <input
                    className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-xl font-bold text-[#004322] outline-none"
                    type="number"
                    min="1"
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#404941]">Prix de réserve minimum (FCFA / {selectedHarvest.unit})</label>
                  <input
                    className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-sm outline-none"
                    type="number"
                    min="1"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-[#404941] italic">
                    L'enchère s'arrête si personne n'achète avant d'atteindre ce prix plancher.
                  </p>
                </div>
              </section>

              {/* Form: 4. Décrémentation */}
              <section className="space-y-4 animate-fadeIn">
                <label className="text-[11px] font-semibold tracking-wider text-[#707970] uppercase block">
                  4. Paramètres de baisse de prix
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#404941]">Montant de la baisse (FCFA)</label>
                    <input
                      className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-sm outline-none"
                      type="number"
                      min="1"
                      value={decrementAmount}
                      onChange={(e) => setDecrementAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#404941]">Fréquence de baisse</label>
                    <select
                      className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-sm outline-none"
                      value={frequencyMinutes}
                      onChange={(e) => setFrequencyMinutes(e.target.value)}
                    >
                      <option value="1">Toutes les 1 min</option>
                      <option value="3">Toutes les 3 min</option>
                      <option value="5">Toutes les 5 min</option>
                      <option value="10">Toutes les 10 min</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Form: 5. Planification */}
              <section className="space-y-4 animate-fadeIn">
                <label className="text-[11px] font-semibold tracking-wider text-[#707970] uppercase block">
                  5. Planification & Durée
                </label>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-[#404941]">Date & Heure de début</label>
                    <input
                      className="w-full bg-[#ffffff] border border-[#c0c9be] focus:border-[#004322] focus:ring-2 focus:ring-[#aef2be] rounded-lg p-3 text-sm outline-none"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#404941]">Durée maximale (heures)</label>
                    <div className="flex gap-2">
                      {['1', '2', '4', '8', '24'].map((hr) => (
                        <button
                          key={hr}
                          type="button"
                          onClick={() => setDurationHours(hr)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                            durationHours === hr
                              ? 'border-[#004322] bg-[#aef2be] text-[#0b522c] font-bold'
                              : 'border-[#c0c9be] text-[#0b1c30] hover:bg-[#eff4ff]'
                          }`}
                        >
                          {hr}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Live Preview Graph */}
              <section className="bg-[#ffddbb]/20 border border-dashed border-[#ffa93d] rounded-xl p-4 space-y-3 animate-fadeIn">
                <span className="text-xs font-bold text-[#885200] block">Aperçu de la décrémentation</span>
                <p className="text-xs leading-tight">
                  Le prix baissera de <strong>{decrementAmount} FCFA</strong> toutes les <strong>{frequencyMinutes} min</strong> de {startPrice} FCFA jusqu'à {reservePrice} FCFA.
                </p>
              </section>
            </>
          )}

          {/* Action buttons */}
          <footer className="fixed bottom-0 w-full z-50 bg-white border-t border-[#c0c9be] max-w-[480px] left-1/2 -translate-x-1/2 px-4 py-4 flex gap-4">
            <button
              type="button"
              onClick={() => void navigate({ to: '/farmer/auctions' })}
              className="flex-1 py-3 px-2 border border-[#707970] rounded-xl text-xs font-semibold text-[#404941] hover:bg-[#eff4ff] active:scale-95 transition-all cursor-pointer text-center"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !selectedHarvestId}
              className="flex-[2] py-3 px-2 bg-[#004322] text-white rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Lancement...' : "Lancer l'enchère"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </footer>
        </form>
      </main>
    </div>
  );
}
