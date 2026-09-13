import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getFarmerHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { createAuctionMutation } from '@/features/auctions/api/auctions.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { useCurrencyStore } from '@/features/currency/store/currency.store';
import type { HarvestDto } from '@futurefarm/types';

export interface NewAuctionSearchParams {
  harvestId?: string;
}

export const Route = createFileRoute('/farmer/auctions/new')({
  validateSearch: (search: Record<string, unknown>): NewAuctionSearchParams => {
    const res: NewAuctionSearchParams = {};
    if (typeof search['harvestId'] === 'string') {
      res.harvestId = search['harvestId'];
    }
    return res;
  },
  component: DutchAuctionNewPage,
});

function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (isToday) return `Aujourd'hui à ${hours}:${minutes}`;
  if (isTomorrow) return `Demain à ${hours}:${minutes}`;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year} à ${hours}:${minutes}`;
}

function DutchStepChart({
  startPrice,
  reservePrice,
  decrementAmount,
}: {
  startPrice: number;
  reservePrice: number;
  decrementAmount: number;
  frequencyMinutes: number;
}) {
  const safeStart = Math.max(1, startPrice);
  const safeReserve = Math.min(safeStart, Math.max(0, reservePrice));
  const safeDec = Math.max(1, decrementAmount);
  const totalDrop = safeStart - safeReserve;
  const numSteps = totalDrop > 0 ? Math.min(6, Math.max(2, Math.ceil(totalDrop / safeDec))) : 1;

  const width = 340;
  const height = 96;
  const padTop = 14;
  const padBottom = 22;
  const padLeft = 14;
  const padRight = 14;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const points: { x: number; y: number; price: number }[] = [];
  const stepWidth = chartWidth / numSteps;

  for (let i = 0; i <= numSteps; i++) {
    const currentPrice = Math.max(safeReserve, safeStart - i * safeDec);
    const yRatio = totalDrop > 0 ? (safeStart - currentPrice) / totalDrop : 0;
    const x = padLeft + i * stepWidth;
    const y = padTop + yRatio * chartHeight;
    points.push({ x, y, price: currentPrice });
  }

  const firstPoint = points[0] ?? { x: padLeft, y: padTop };
  const lastPoint = points[points.length - 1] ?? firstPoint;

  let pathD = `M ${firstPoint.x} ${firstPoint.y}`;
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]!;
    const prevPt = points[i - 1]!;
    pathD += ` L ${pt.x} ${prevPt.y} L ${pt.x} ${pt.y}`;
  }

  const fillD = `${pathD} L ${lastPoint.x} ${height - padBottom} L ${firstPoint.x} ${height - padBottom} Z`;
  const reserveY = padTop + chartHeight;

  return (
    <div className="w-full bg-[#fdfcfa] border border-[#f3e8d7] rounded-xl p-2.5 overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="dutchFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        <path d={fillD} fill="url(#dutchFill)" />

        <line
          x1={padLeft}
          y1={reserveY}
          x2={width - padRight}
          y2={reserveY}
          stroke="#ef4444"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text
          x={padLeft + 2}
          y={reserveY - 4}
          fill="#dc2626"
          fontSize="9.5"
          fontWeight="600"
        >
          Prix de réserve ({safeReserve.toLocaleString('fr-FR')})
        </text>

        <path
          d={pathD}
          fill="none"
          stroke="#92400e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={idx === 0 ? 3.5 : 2.5}
            fill={idx === 0 ? '#92400e' : '#d97706'}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  );
}

function DutchAuctionNewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const currencies = useCurrencyStore((s) => s.currencies);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);

  // Queries
  const { data: harvests, isLoading: isLoadingHarvests } = useQuery(getFarmerHarvestsQuery());
  const approvedHarvests = useMemo(
    () => (harvests ? harvests.filter((h) => h.status === 'APPROVED') : []),
    [harvests],
  );

  // UI modal state for harvest selection
  const [showHarvestPicker, setShowHarvestPicker] = useState(false);

  // Form states
  const [selectedHarvestId, setSelectedHarvestId] = useState(search.harvestId || '');
  const [quantity, setQuantity] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [decrementAmount, setDecrementAmount] = useState('50');
  const [frequencyMinutes, setFrequencyMinutes] = useState('3');

  // Default start at 5 minutes from now, default end 2 hours later
  const defaultStartTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, []);

  const defaultEndTime = useMemo(() => {
    const d = new Date(Date.now() + (2 * 60 + 5) * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, []);

  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);

  // Synchronize when harvests load or search param changes
  useEffect(() => {
    if (approvedHarvests.length === 0) return;

    let target: HarvestDto | undefined;
    if (search.harvestId) {
      target = approvedHarvests.find((item) => item.id === search.harvestId);
    }
    if (!target && !selectedHarvestId) {
      target = approvedHarvests[0];
    }

    if (target) {
      setSelectedHarvestId(target.id);
      const stock = Math.max(0, Number(target.quantityInStock) - Number(target.stockMarge || 0));
      const defaultLot = stock > 500 ? 500 : stock;
      setQuantity(String(defaultLot || stock));

      const basePrice = Number(target.pricePerUnit) || 3500;
      setStartPrice(String(Math.round(basePrice)));
      setReservePrice(String(Math.round(basePrice * 0.8)));
      setDecrementAmount(String(Math.max(10, Math.round(basePrice * 0.015))));
    }
  }, [search.harvestId, approvedHarvests]);

  const selectedHarvest = useMemo(
    () => approvedHarvests.find((h) => h.id === selectedHarvestId),
    [approvedHarvests, selectedHarvestId],
  );

  const effectiveStock = selectedHarvest
    ? Math.max(0, Number(selectedHarvest.quantityInStock) - Number(selectedHarvest.stockMarge || 0))
    : 0;

  const remainingStock = effectiveStock - Number(quantity || 0);

  const harvestCurrency = selectedHarvest?.currency || selectedCurrency || 'CDF';
  const currencySymbol = useMemo(() => {
    const curr = currencies.find((c) => c.code === harvestCurrency);
    return curr?.symbol || harvestCurrency;
  }, [currencies, harvestCurrency]);

  const unit = selectedHarvest?.unit ? selectedHarvest.unit.toLowerCase() : 'kg';

  // AI Quality Score (converted to percentage)
  const qualityPercent = useMemo(() => {
    if (!selectedHarvest) return 94;
    const score = Number(selectedHarvest.qualityScore);
    if (isNaN(score) || score <= 0) return 94;
    return score <= 10 ? Math.round(score * 10) : Math.round(score);
  }, [selectedHarvest]);

  // AI Suggested Price
  const aiSuggestedPrice = useMemo(() => {
    if (!selectedHarvest) return 3200;
    const base = Number(selectedHarvest.pricePerUnit);
    return !isNaN(base) && base > 0 ? Math.round(base * 0.95) : 3200;
  }, [selectedHarvest]);

  // Projected price in 30 minutes
  const projected30MinPrice = useMemo(() => {
    const start = Number(startPrice) || 0;
    const reserve = Number(reservePrice) || 0;
    const dec = Number(decrementAmount) || 0;
    const freq = Number(frequencyMinutes) || 3;
    const intervalsIn30Min = Math.floor(30 / freq);
    const drop = intervalsIn30Min * dec;
    return Math.max(reserve, start - drop);
  }, [startPrice, reservePrice, decrementAmount, frequencyMinutes]);

  // Mutation
  const { mutate: createAuction, isPending } = useMutation({
    ...createAuctionMutation(),
    onSuccess: () => {
      addToast('Enchère hollandaise lancée avec succès !', 'success');
      void navigate({ to: '/farmer/auctions' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || "Erreur lors de la création de l'enchère.";
      addToast(msg, 'error');
    },
  });

  const handleSelectHarvest = (harvest: HarvestDto) => {
    setSelectedHarvestId(harvest.id);
    const stock = Math.max(0, Number(harvest.quantityInStock) - Number(harvest.stockMarge || 0));
    const defaultLot = stock > 500 ? 500 : stock;
    setQuantity(String(defaultLot || stock));

    const basePrice = Number(harvest.pricePerUnit) || 3500;
    setStartPrice(String(Math.round(basePrice)));
    setReservePrice(String(Math.round(basePrice * 0.8)));
    setDecrementAmount(String(Math.max(10, Math.round(basePrice * 0.015))));
    setShowHarvestPicker(false);
  };

  const handleSaveDraft = () => {
    const draftData = {
      harvestId: selectedHarvestId,
      quantity,
      startPrice,
      reservePrice,
      decrementAmount,
      frequencyMinutes,
      startTime,
      endTime,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('futurefarm:auction_draft', JSON.stringify(draftData));
      addToast('Brouillon enregistré avec succès', 'info');
    } catch {
      addToast('Impossible de sauvegarder le brouillon', 'warning');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHarvestId) {
      addToast('Veuillez sélectionner un lot de récolte.', 'warning');
      return;
    }
    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      addToast('Veuillez entrer une quantité valide.', 'warning');
      return;
    }
    if (numQty > effectiveStock) {
      addToast(`La quantité dépasse le stock disponible (${effectiveStock} ${unit}).`, 'warning');
      return;
    }

    const numStart = Number(startPrice);
    const numReserve = Number(reservePrice);
    if (isNaN(numStart) || isNaN(numReserve) || numStart <= 0) {
      addToast('Prix de départ ou prix de réserve invalide.', 'warning');
      return;
    }
    if (numReserve >= numStart) {
      addToast('Le prix de réserve doit être strictement inférieur au prix de départ.', 'warning');
      return;
    }

    const startAtDate = new Date(startTime);
    const endAtDate = new Date(endTime);
    if (isNaN(startAtDate.getTime()) || isNaN(endAtDate.getTime())) {
      addToast('Dates de début ou de fin invalides.', 'warning');
      return;
    }
    if (startAtDate >= endAtDate) {
      addToast('La date de début doit précéder la date de fin.', 'warning');
      return;
    }
    if (endAtDate <= new Date()) {
      addToast('La date de fin doit être dans le futur.', 'warning');
      return;
    }

    createAuction({
      harvestId: selectedHarvestId,
      startingPrice: numStart,
      reservePrice: numReserve,
      priceDecrementAmount: Number(decrementAmount) || 10,
      priceDecrementIntervalMinutes: Number(frequencyMinutes) || 3,
      startAt: startAtDate.toISOString(),
      endAt: endAtDate.toISOString(),
      quantityOnOffer: numQty,
    });
  };

  return (
    <div className="bg-[#fcfdfc] text-[#0b1c30] min-h-screen pb-44 relative font-sans">
      <main className="pt-3 px-4 max-w-[480px] mx-auto space-y-6">
        {/* Title & Introduction */}
        <section className="space-y-1">
          <h2 className="text-[22px] font-bold text-[#0b1c30] tracking-tight">
            Enchère Hollandaise
          </h2>
          <p className="text-[13px] text-[#404941] leading-relaxed">
            Le prix diminue automatiquement jusqu'à trouver un acheteur.
          </p>
        </section>

        {isLoadingHarvests ? (
          <div className="bg-white border border-[#c0c9be] rounded-2xl p-8 text-center space-y-3">
            <Icon name="progress_activity" className="text-3xl text-[#004322] animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Chargement des récoltes approuvées...</p>
          </div>
        ) : approvedHarvests.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
            <Icon name="inventory_2" className="text-4xl text-amber-600 mx-auto" />
            <h3 className="text-sm font-bold text-amber-900">Aucune récolte approuvée disponible</h3>
            <p className="text-xs text-amber-700">
              Vous devez avoir au moins une récolte validée par un inspecteur pour créer une enchère.
            </p>
            <Link
              to="/farmer/stock"
              className="inline-block mt-2 px-4 py-2 bg-[#004322] text-white text-xs font-semibold rounded-xl"
            >
              Voir mon stock
            </Link>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-6">
            {/* Section 1: Produit */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-[#707970] uppercase">
                  1. PRODUIT
                </span>
                <button
                  type="button"
                  onClick={() => setShowHarvestPicker(true)}
                  className="text-[13px] font-semibold text-[#004322] hover:underline cursor-pointer"
                >
                  Modifier
                </button>
              </div>

              {selectedHarvest && (
                <div className="bg-white border border-[#c0c9be] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-xs">
                  <div className="w-18 h-18 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                    <img
                      src={
                        selectedHarvest.photoUrls?.[0] ||
                        'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=200'
                      }
                      alt={selectedHarvest.product?.name || 'Produit'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-[15px] font-bold text-[#0b1c30] truncate">
                      {selectedHarvest.product?.name || 'Lot Récolté'}
                      {selectedHarvest.product?.category
                        ? ` (Cat. ${selectedHarvest.product.category.slice(0, 1)})`
                        : ''}
                    </h3>
                    <p className="text-xs text-[#404941]">
                      Stock disponible :{' '}
                      <span className="font-semibold text-gray-900">
                        {effectiveStock.toLocaleString('fr-FR')} {unit}
                      </span>
                    </p>
                    <div>
                      <span className="inline-flex items-center gap-1 bg-[#d1f2d9] text-[#004322] border border-[#aef2be] rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                        <Icon name="verified" size={13} className="text-[#004322]" />
                        Qualité IA : {qualityPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 2: Lot de vente */}
            <section className="space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-[#707970] uppercase block">
                2. LOT DE VENTE
              </span>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={effectiveStock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="500"
                  required
                  className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3.5 text-base font-semibold text-[#0b1c30] outline-none transition-all pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#707970] uppercase">
                  {unit}
                </span>
              </div>

              {/* Remaining stock notification banner */}
              {remainingStock >= 0 ? (
                <div className="bg-[#ffeacc] border border-[#ffd599] rounded-xl p-3 text-xs text-[#8c4b00] flex items-center gap-2.5 font-medium leading-tight">
                  <Icon name="info" size={18} className="shrink-0 text-[#b45309]" />
                  <span>
                    Attention : il restera{' '}
                    <strong className="font-bold">
                      {remainingStock.toLocaleString('fr-FR')} {unit}
                    </strong>{' '}
                    en stock après cette mise en enchère.
                  </span>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-center gap-2.5 font-medium leading-tight">
                  <Icon name="warning" size={18} className="shrink-0 text-red-600" />
                  <span>
                    La quantité dépasse le stock disponible ({effectiveStock.toLocaleString('fr-FR')}{' '}
                    {unit}).
                  </span>
                </div>
              )}
            </section>

            {/* Section 3: Tarification */}
            <section className="space-y-4">
              <span className="text-[11px] font-bold tracking-wider text-[#707970] uppercase block">
                3. TARIFICATION
              </span>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#404941]">
                  Prix de départ ({currencySymbol}/{unit})
                </label>
                <input
                  type="number"
                  min="1"
                  value={startPrice}
                  onChange={(e) => setStartPrice(e.target.value)}
                  placeholder="3500"
                  required
                  className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3 text-3xl font-extrabold text-[#004322] outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setStartPrice(String(aiSuggestedPrice))}
                  className="text-xs font-semibold text-[#004322] flex items-center gap-1 hover:underline cursor-pointer pt-0.5"
                >
                  <Icon name="sparkles" size={14} className="text-[#004322]" />
                  Prix suggéré par l'IA : {aiSuggestedPrice.toLocaleString('fr-FR')} {currencySymbol}/
                  {unit}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#404941]">
                  Prix de réserve (minimum)
                </label>
                <input
                  type="number"
                  min="1"
                  value={reservePrice}
                  onChange={(e) => setReservePrice(e.target.value)}
                  placeholder="2800"
                  required
                  className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3.5 text-base font-semibold text-[#0b1c30] outline-none transition-all"
                />
                <p className="text-[11px] text-[#707970] leading-tight">
                  L'enchère s'arrête si personne n'achète avant d'atteindre ce prix.
                </p>
              </div>
            </section>

            {/* Section 4: Paramètres de baisse */}
            <section className="space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-[#707970] uppercase block">
                4. PARAMÈTRES DE BAISSE
              </span>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#404941]">Montant de la baisse</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={decrementAmount}
                      onChange={(e) => setDecrementAmount(e.target.value)}
                      placeholder="50"
                      required
                      className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3 text-sm font-semibold text-[#0b1c30] outline-none transition-all pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#707970]">
                      {currencySymbol}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#404941]">Fréquence de baisse</label>
                  <select
                    value={frequencyMinutes}
                    onChange={(e) => setFrequencyMinutes(e.target.value)}
                    className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3 text-sm font-semibold text-[#0b1c30] outline-none transition-all cursor-pointer"
                  >
                    <option value="1">1 min</option>
                    <option value="2">2 min</option>
                    <option value="3">3 min</option>
                    <option value="5">5 min</option>
                    <option value="10">10 min</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="60">1 h</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Section 5: Planification */}
            <section className="space-y-4">
              <span className="text-[11px] font-bold tracking-wider text-[#707970] uppercase block">
                5. PLANIFICATION
              </span>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#404941]">
                  <Icon name="calendar_today" size={14} className="text-[#004322]" />
                  <span>Debut de l'enchère : {formatFriendlyDate(startTime)}</span>
                </div>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3 text-sm font-medium text-[#0b1c30] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#404941]">
                  <Icon name="calendar_today" size={14} className="text-[#004322]" />
                  <span>Fin de l'enchère : {formatFriendlyDate(endTime)}</span>
                </div>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full bg-white border border-[#c0c9be] focus:border-[#004322] focus:ring-1 focus:ring-[#004322] rounded-xl p-3 text-sm font-medium text-[#0b1c30] outline-none transition-all"
                  />
                </div>
              </div>
            </section>

            {/* Section 6: Aperçu de votre enchère */}
            <section className="border-2 border-dashed border-[#f59e0b] rounded-2xl p-3.5 bg-[#fffcf5] space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#b45309]">
                <Icon name="visibility" size={18} />
                <span>Aperçu de votre enchère</span>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5e7eb] space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">
                      {selectedHarvest?.product?.name || 'Gombo frais'}
                      {selectedHarvest?.product?.category
                        ? ` (Cat. ${selectedHarvest.product.category.slice(0, 1)})`
                        : ''}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Lot de {Number(quantity || 0).toLocaleString('fr-FR')} {unit}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1 bg-[#ffe4e6] text-[#e11d48] border border-[#fecdd3] rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0">
                    <Icon name="schedule" size={12} />
                    Baisse imminente
                  </span>
                </div>

                {/* Price Display */}
                <div className="text-center space-y-0.5 pt-1 pb-1">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Prix actuel
                  </p>
                  <p className="text-4xl font-extrabold text-gray-900 tracking-tight">
                    {Number(startPrice || 0).toLocaleString('fr-FR')}
                  </p>
                  <p className="text-xs font-semibold text-gray-500">
                    {currencySymbol}/{unit}
                  </p>
                </div>

                {/* Stepped Down Graph */}
                <DutchStepChart
                  startPrice={Number(startPrice) || 3500}
                  reservePrice={Number(reservePrice) || 2800}
                  decrementAmount={Number(decrementAmount) || 50}
                  frequencyMinutes={Number(frequencyMinutes) || 3}
                />

                {/* Projection Callout */}
                <div className="bg-[#eef6ff] border border-[#d0e4ff] rounded-xl p-3 flex items-center gap-2.5 text-xs text-[#1e40af] font-medium leading-snug">
                  <Icon name="trending_down" size={18} className="shrink-0 text-blue-600" />
                  <span>
                    Dans 30min, le prix sera de{' '}
                    <strong className="font-bold text-blue-900">
                      {projected30MinPrice.toLocaleString('fr-FR')} {currencySymbol}/{unit}
                    </strong>{' '}
                    si aucun acheteur ne se manifeste.
                  </span>
                </div>
              </div>
            </section>

            {/* Action Buttons: Fixed bottom footer */}
            <footer className="fixed bottom-16 w-full z-40 bg-white/95 backdrop-blur-md border-t border-[#c0c9be] max-w-[480px] left-1/2 -translate-x-1/2 px-4 py-3 flex gap-3 shadow-md">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex-1 py-3 px-3 border border-[#c0c9be] rounded-xl text-xs font-bold text-[#404941] bg-white hover:bg-gray-50 active:scale-95 transition-all cursor-pointer text-center"
              >
                Brouillon
              </button>
              <button
                type="submit"
                disabled={isPending || !selectedHarvestId}
                className="flex-[2] py-3 px-3 bg-[#004322] hover:bg-[#00331a] text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Icon name="progress_activity" size={16} className="animate-spin" />
                    <span>Lancement...</span>
                  </>
                ) : (
                  <>
                    <span>Lancer l'enchère</span>
                    <Icon name="arrow_forward" size={16} />
                  </>
                )}
              </button>
            </footer>
          </form>
        )}

        {/* Harvest Picker Modal */}
        {showHarvestPicker && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-[480px] w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Choisir un lot récolté</h3>
                  <p className="text-xs text-gray-500">Seuls les lots approuvés peuvent être mis aux enchères</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHarvestPicker(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
                >
                  <Icon name="close" size={20} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                {approvedHarvests.map((h) => {
                  const isSelected = h.id === selectedHarvestId;
                  const stock = Math.max(0, Number(h.quantityInStock) - Number(h.stockMarge || 0));
                  const score = h.qualityScore != null ? Math.round(Number(h.qualityScore) <= 10 ? Number(h.qualityScore) * 10 : Number(h.qualityScore)) : 94;

                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => handleSelectHarvest(h)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#004322] bg-[#004322]/5 ring-1 ring-[#004322]'
                          : 'border-gray-200 hover:border-[#004322]/40 bg-white'
                      }`}
                    >
                      <img
                        src={h.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=120'}
                        alt={h.product?.name || 'Lot'}
                        className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-900 truncate">
                            {h.product?.name || 'Lot'}
                          </h4>
                          <span className="text-[11px] font-bold text-[#004322]">
                            {Number(h.pricePerUnit || 0).toLocaleString('fr-FR')} {h.currency || 'CDF'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Stock: {stock.toLocaleString('fr-FR')} {h.unit?.toLowerCase() || 'kg'} • Lot #{h.id.slice(0, 4)}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#004322] bg-[#d1f2d9] px-2 py-0.5 rounded-full mt-1">
                          <Icon name="verified" size={10} />
                          Qualité IA : {score}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
