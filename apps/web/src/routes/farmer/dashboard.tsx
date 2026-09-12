import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFarmerHarvestsQuery } from '@/features/harvests/api/harvests.queries';
import { getSellerOrdersQuery } from '@/features/orders/api/orders.queries';
import { useVisits } from '@/features/inspector/api/visits.queries';
import {
  useOfflineSyncState,
  syncOfflineHarvests,
  refreshOfflineQueueState,
} from '@/features/harvests/offline';

export const Route = createFileRoute('/farmer/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [alertOpen, setAlertOpen] = useState(true);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const {
    isOnline,
    pendingCount,
    isSyncing,
    pendingAnalysisCount,
    readyForReviewCount,
    tempDrafts,
  } = useOfflineSyncState();

  useEffect(() => {
    void refreshOfflineQueueState();
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    await syncOfflineHarvests(queryClient);
  };

  // Queries
  const { data: harvests } = useQuery(getFarmerHarvestsQuery());
  const { data: orders } = useQuery(getSellerOrdersQuery());
  const { data: visits } = useVisits();

  // Stats calculations
  const totalRevenue = orders
    ? orders
        .filter((o) => o.status === 'CONFIRMED' || o.status === 'DELIVERED')
        .reduce((sum, o) => sum + o.totalPrice, 0)
    : 0;

  const harvestsWithScore = (harvests || []).filter(
    (h) => h.qualityScore != null && !isNaN(Number(h.qualityScore)) && Number(h.qualityScore) > 0
  );

  const averageQuality = harvestsWithScore.length > 0
    ? Math.round(
        harvestsWithScore.reduce((sum, h) => {
          const score = Number(h.qualityScore);
          return sum + (score <= 10 ? score * 10 : score);
        }, 0) / harvestsWithScore.length
      )
    : null;

  const activeListingsCount = harvests
    ? harvests.filter((h) => h.status === 'APPROVED' || h.status === 'PENDING_APPROVAL' || h.status === 'FLAGGED_PHYSICAL').length
    : 0;

  const pendingOrdersCount = orders ? orders.filter((o) => o.status === 'PENDING').length : 0;

  // Upcoming visits & flagged harvests for physical inspection
  const plannedVisits = (visits || []).filter((v) => v.status === 'PLANNED');
  const flaggedHarvests = (harvests || []).filter((h) => h.status === 'FLAGGED_PHYSICAL');

  // Dynamic activity feed
  const activities = [
    ...(harvests || []).map((h) => ({
      id: h.id,
      type: 'harvest' as const,
      title: `Lot #${h.id.slice(0, 4)} - ${h.product?.name || 'Produit'}`,
      description: h.status === 'APPROVED'
        ? 'Lot approuvé par l\'inspecteur'
        : h.status === 'PENDING_APPROVAL'
        ? 'Lot en attente d\'approbation'
        : h.status === 'FLAGGED_PHYSICAL'
        ? 'Visite d\'inspection sur site requise'
        : 'Lot rejeté ou archivé',
      status: h.status === 'APPROVED'
        ? 'Actif'
        : h.status === 'PENDING_APPROVAL'
        ? 'En attente'
        : h.status === 'FLAGGED_PHYSICAL'
        ? 'Visite requise'
        : 'Inactif',
      statusColor: h.status === 'APPROVED'
        ? 'text-[#1A5C35]'
        : h.status === 'FLAGGED_PHYSICAL'
        ? 'text-amber-700'
        : 'text-[#885200]',
      time: new Date(h.createdAt).toLocaleDateString(),
      image: h.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?w=100',
    })),
    ...(orders || []).map((o) => ({
      id: o.id,
      type: 'order' as const,
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
        <div className="bg-secondary-container text-on-secondary-container px-4 py-3 flex items-center gap-3 animate-pulse shadow-sm max-w-[480px] mx-auto rounded-xl mt-2 mb-2">
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

      {/* Main Content */}
      <main className="px-4 max-w-[480px] mx-auto space-y-6 pt-4">
        {/* Drafts Ready for Review Banner */}
        {readyForReviewCount > 0 && (
          <section className="bg-[#eff4ff] border-2 border-[#004322] p-4 rounded-xl shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#004322] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                <span className="text-xs font-bold text-[#004322]">
                  {readyForReviewCount} récolte{readyForReviewCount > 1 ? 's' : ''} analysée{readyForReviewCount > 1 ? 's' : ''} prête{readyForReviewCount > 1 ? 's' : ''} à réviser
                </span>
              </div>
              <span className="bg-[#004322] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                Action requise
              </span>
            </div>
            <p className="text-[11px] text-[#404941] leading-relaxed">
              L'analyse IA de vos photos est terminée. Consultez les estimations de qualité et confirmez vos lots avant publication.
            </p>
            <div className="flex flex-col gap-2">
              {tempDrafts
                .filter((d) => d.status === 'ANALYZED_READY_FOR_REVIEW')
                .map((draft) => (
                  <div
                    key={draft.id}
                    className="bg-white border border-[#c0c9be] p-2.5 rounded-lg flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0b1c30] truncate">
                        {draft.manualForm?.productName || draft.aiResult?.suggestedName || 'Récolte'}
                      </p>
                      <p className="text-[10px] text-[#707970]">
                        Qualité IA : {draft.aiResult?.aiQualityScore ? Math.round(draft.aiResult.aiQualityScore * 10) : 90}%
                      </p>
                    </div>
                    <Link
                      to="/farmer/harvests/new"
                      search={{ reviewDraftId: draft.id }}
                      className="bg-[#004322] hover:bg-[#1a5c35] text-white py-1.5 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      Réviser
                    </Link>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Drafts Pending AI Analysis Banner */}
        {pendingAnalysisCount > 0 && (
          <section className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl shadow-sm flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">
              cloud_sync
            </span>
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-bold">
                {pendingAnalysisCount} récolte{pendingAnalysisCount > 1 ? 's' : ''} en attente d'analyse IA
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Vos photos et estimations sont stockées localement. L'analyse IA débutera automatiquement dès le retour du réseau.
              </p>
            </div>
          </section>
        )}

        {/* Offline Sync Status Banner */}
        {pendingCount > 0 && (
          <section className="bg-[#e8f5e9] border border-[#aef2be] p-4 rounded-xl shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[#1a5c35] ${isSyncing ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  sync
                </span>
                <span className="text-xs font-bold text-[#1a5c35]">
                  {pendingCount} récolte{pendingCount > 1 ? 's' : ''} en attente de synchronisation
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isOnline ? 'En ligne' : 'Hors-ligne'}
              </span>
            </div>
            <p className="text-[11px] text-[#404941] leading-relaxed">
              {isOnline
                ? 'Connexion active. Vos données locales sont prêtes à être envoyées vers le serveur.'
                : 'Vos données sont stockées en toute sécurité sur votre appareil. La synchronisation démarrera automatiquement dès rétablissement du réseau.'}
            </p>
            {isOnline && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="bg-[#004322] text-white py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                {isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
              </button>
            )}
          </section>
        )}

        {!isOnline && pendingCount === 0 && (
          <section className="bg-[#fff8e1] border border-[#ffe082] p-3 rounded-xl shadow-sm flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-700" style={{ fontVariationSettings: "'FILL' 1" }}>
              cloud_off
            </span>
            <div className="text-xs">
              <p className="font-bold text-amber-800">Mode hors-ligne actif</p>
              <p className="text-amber-900/80 text-[10px] mt-0.5">
                Toutes les nouvelles récoltes enregistrées seront sauvegardées localement.
              </p>
            </div>
          </section>
        )}

        {/* KPI Bento Grid */}
        <section className="grid grid-cols-2 gap-4">
          {/* Revenue Card */}
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex flex-col justify-between aspect-square shadow-sm">
            <span className="material-symbols-outlined text-[#885200] self-start">payments</span>
            <div>
              <p className="text-xs text-[#6B7280]">Revenu total</p>
              <p className="text-lg font-bold text-[#1C1C1C] tracking-tight">
                {totalRevenue.toLocaleString()} <span className="text-[10px] font-normal">CDF</span>
              </p>
              <p className="text-[9px] text-[#6B7280] mt-1">Revenus cumulés confirmés</p>
            </div>
          </div>

          {/* Quality Gauge Card */}
          <div className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex flex-col items-center justify-center aspect-square text-center shadow-sm">
            {averageQuality !== null ? (
              <>
                <div className="relative w-20 h-20 mb-2 flex items-center justify-center">
                  <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90 block">
                    <circle cx="40" cy="40" fill="transparent" r="34" stroke="#E5E7EB" strokeWidth="6" />
                    <circle
                      className="text-[#1A5C35]"
                      cx="40"
                      cy="40"
                      fill="transparent"
                      r="34"
                      stroke="currentColor"
                      strokeDasharray="213.63"
                      strokeDashoffset={213.63 * (1 - averageQuality / 100)}
                      strokeLinecap="round"
                      strokeWidth="6"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-bold text-[#1C1C1C] leading-none">{averageQuality}%</span>
                  </div>
                </div>
                <p className="text-xs text-[#6B7280]">Score de qualité</p>
                <p className="text-[9px] text-[#6B7280] mt-1 leading-tight">Moyenne des scores de vos récoltes</p>
              </>
            ) : (
              <>
                <div className="relative w-20 h-20 mb-2 flex items-center justify-center">
                  <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90 block">
                    <circle cx="40" cy="40" fill="transparent" r="34" stroke="#E5E7EB" strokeWidth="6" strokeDasharray="4 4" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-xl">psychology_alt</span>
                    <span className="text-xs font-bold text-gray-400 leading-none mt-0.5">--</span>
                  </div>
                </div>
                <p className="text-xs text-[#6B7280] font-medium">Score de qualité</p>
                <p className="text-[9px] text-gray-500 mt-1 leading-tight px-1">
                  Aucune récolte pour calculer le score de qualité
                </p>
              </>
            )}
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

        {/* Upcoming Physical Inspections & Visits */}
        {(plannedVisits.length > 0 || flaggedHarvests.length > 0) && (
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-700 text-lg">event_available</span>
                <h2 className="text-base font-bold text-on-surface">Inspections terrain à venir</h2>
              </div>
              <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                {plannedVisits.length + flaggedHarvests.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {plannedVisits.map((visit) => (
                <div
                  key={visit.id}
                  onClick={() => {
                    if (visit.harvestId) {
                      void navigate({ to: '/farmer/products/$id', params: { id: visit.harvestId } });
                    }
                  }}
                    className={`bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl shadow-xs space-y-2 transition-all ${
                      visit.harvestId ? 'cursor-pointer hover:bg-amber-100/70 hover:border-amber-300' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          Visite programmée {visit.plannedDate ? `le ${visit.plannedDate}` : ''}
                          {visit.harvestId && (
                            <span className="material-symbols-outlined text-xs text-amber-800">chevron_right</span>
                          )}
                        </p>
                        {visit.plannedTime && (
                          <p className="text-[11px] text-amber-900/80 font-medium">
                            Heure prévue : {visit.plannedTime}
                          </p>
                        )}
                      </div>
                      <span className="bg-amber-200/60 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Confirmée
                      </span>
                    </div>

                    {visit.inspectorName && (
                      <p className="text-[11px] text-gray-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">badge</span>
                        Inspecteur : <span className="font-semibold text-gray-800">{visit.inspectorName}</span>
                      </p>
                    )}

                    {visit.notes && (
                      <p className="text-[11px] text-gray-600 bg-white/70 p-2 rounded-lg border border-amber-100 italic">
                        « {visit.notes} »
                      </p>
                    )}
                  </div>
                ))}

              {flaggedHarvests
                .filter((h) => !plannedVisits.some((v) => v.harvestId === h.id))
                .map((harvest) => (
                  <div
                    key={harvest.id}
                    onClick={() => void navigate({ to: '/farmer/products/$id', params: { id: harvest.id } })}
                    className="bg-amber-50/50 border border-amber-200/60 p-3.5 rounded-xl shadow-xs space-y-2 cursor-pointer hover:bg-amber-100/60 hover:border-amber-300 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          {harvest.product?.name || 'Lot agricole'} #{harvest.id.slice(0, 4)}
                          <span className="material-symbols-outlined text-xs text-amber-800">chevron_right</span>
                        </p>
                        <p className="text-[11px] text-amber-800">
                          En attente de planification par l'inspecteur
                        </p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Visite requise
                      </span>
                    </div>
                    {harvest.rejectionReason && (
                      <p className="text-[11px] text-gray-600 bg-white/70 p-2 rounded-lg border border-amber-100">
                        {harvest.rejectionReason}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

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
                <div
                  key={act.id}
                  onClick={() => {
                    if (act.type === 'harvest') {
                      void navigate({ to: '/farmer/products/$id', params: { id: act.id } });
                    } else {
                      void navigate({ to: '/farmer/orders' });
                    }
                  }}
                  className="bg-white border border-[#E5E7EB] p-4 rounded-xl flex items-center gap-4 shadow-sm cursor-pointer hover:border-[#1A5C35] hover:shadow-md transition-all"
                >
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

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setShowBottomSheet(true)}
        aria-label="Actions rapides"
        className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-[#1A5C35] hover:bg-[#144a2a] text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

      {/* Action Bottom Sheet */}
      {showBottomSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pb-20 md:pb-6 px-3">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowBottomSheet(false)}
          />

          {/* Sheet */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 border border-gray-200">
            {/* Grab handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Actions rapides</h3>
                <p className="text-xs text-gray-500">Choisissez une opération à effectuer</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBottomSheet(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowBottomSheet(false);
                  void navigate({ to: '/farmer/harvests/analyze' });
                }}
                className="w-full flex items-center gap-3.5 p-3.5 bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-200 rounded-2xl text-left transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#1A5C35] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 group-hover:text-[#1A5C35]">
                    Nouvelle Récolte
                  </h4>
                  <p className="text-[11px] text-gray-500 truncate">
                    Scanner et analyser un lot récolté par IA
                  </p>
                </div>
                <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowBottomSheet(false);
                  void navigate({ to: '/farmer/auctions/new' });
                }}
                className="w-full flex items-center gap-3.5 p-3.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl text-left transition-colors cursor-pointer group shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-[#ffa93d]/20 text-[#885200] border border-[#ffa93d]/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">gavel</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 group-hover:text-[#885200]">
                    Lancer une Enchère
                  </h4>
                  <p className="text-[11px] text-gray-500 truncate">
                    Mettre un lot aux enchères en direct
                  </p>
                </div>
                <span className="material-symbols-outlined text-gray-400 text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
