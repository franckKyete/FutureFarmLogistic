import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getRunDetailsQuery,
  arriveAtStopMutation,
  completeStopMutation,
  skipStopMutation,
  uploadStopProofMutation,
  pushLocationMutation,
  startTransitMutation,
  completeRunMutation,
} from '@/features/tracking/api/tracking.queries';
import { useDeliveryMap } from '@/features/shared/hooks/useDeliveryMap';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { DeliveryRunStatus, DeliveryStopStatus, DeliveryStopType } from '@futurefarm/types';
import { addToast } from '@/features/shared/store/toast.store';
import { PickupReportModal } from '@/features/tracking/components/PickupReportModal';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const Route = createFileRoute('/driver/runs/$id')({
  component: DriverRunDetailPage,
});

function DriverRunDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();

  const { data: run, isLoading, isError, refetch } = useQuery(getRunDetailsQuery(id));
  const { location } = useDeliveryMap(id);

  const arriveStop = useMutation({
    ...arriveAtStopMutation(),
    onSuccess: () => {
      addToast('Arrivée enregistrée au point de livraison', 'success');
      void refetch();
    },
    onError: () => addToast("Erreur lors de l'enregistrement de l'arrivée", 'error'),
  });

  const completeStop = useMutation({
    ...completeStopMutation(),
    onSuccess: () => {
      addToast('Arrêt validé avec succès !', 'success');
      void refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || "Erreur lors de la finalisation de l'arrêt";
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const skipStop = useMutation({
    ...skipStopMutation(),
    onSuccess: () => {
      addToast('Arrêt ignoré', 'info');
      setSkippingStopId(null);
      setSkipReason('');
      void refetch();
    },
    onError: () => addToast("Erreur lors de l'action", 'error'),
  });

  const uploadProof = useMutation({
    ...uploadStopProofMutation(),
    onSuccess: () => {
      addToast('Photo justificative enregistrée', 'success');
      void refetch();
    },
    onError: () => addToast('Erreur lors du téléversement de la photo', 'error'),
  });

  const startTransit = useMutation({
    ...startTransitMutation(),
    onSuccess: () => {
      addToast('Transit démarré ! Les articles sont en route.', 'success');
      void refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors du démarrage du transit';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const completeRun = useMutation({
    ...completeRunMutation(),
    onSuccess: () => {
      addToast('Tournée terminée avec succès ! Félicitations.', 'success');
      void refetch();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la clôture de la tournée';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const pushLocation = useMutation(pushLocationMutation());

  // State for skip stop modal
  const [skippingStopId, setSkippingStopId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  // State for pickup report modal (COLLECTION stops)
  const [pickupReportStopId, setPickupReportStopId] = useState<string | null>(null);

  // File input ref for photo upload
  const [uploadingStopId, setUploadingStopId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GPS Ping broadcasting when run is in progress
  useEffect(() => {
    if (run?.status !== DeliveryRunStatus.IN_PROGRESS) return;

    const sendPing = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const pingPayload: {
              runId: string;
              lat: number;
              lon: number;
              heading?: number;
              speedKmh?: number;
            } = {
              runId: id,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            };
            if (pos.coords.heading != null && !isNaN(pos.coords.heading)) {
              pingPayload.heading = pos.coords.heading;
            }
            if (pos.coords.speed != null && !isNaN(pos.coords.speed)) {
              pingPayload.speedKmh = Math.round(pos.coords.speed * 3.6);
            }
            pushLocation.mutate(pingPayload);
          },
          (err) => {
            console.warn('Geolocation acquisition error:', err.message);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
        );
      }
    };

    sendPing();
    const interval = setInterval(sendPing, 10000);
    return () => clearInterval(interval);
  }, [id, run?.status]);

  const mapStops: MapStop[] = useMemo(() => {
    if (!run?.stops) return [];
    return run.stops.map((s, idx) => ({
      id: s.id,
      lat: s.address.lat,
      lon: s.address.lon,
      label: `${idx + 2} - ${s.type === 'COLLECTION' ? 'COLLECTE' : 'LIVRAISON'}`,
      type: s.type as 'COLLECTION' | 'DELIVERY',
      status: s.status,
    }));
  }, [run?.stops]);

  const sortedStops = useMemo(() => {
    if (!run?.stops) return [];
    return [...run.stops].sort((a, b) => a.sequence - b.sequence);
  }, [run?.stops]);

  // Determine current active stop (first non-completed stop)
  const currentActiveStop = sortedStops.find(
    (s) => s.status !== DeliveryStopStatus.COMPLETED && s.status !== DeliveryStopStatus.SKIPPED,
  ) || sortedStops[sortedStops.length - 1] || sortedStops[0];

  const collectionStop = sortedStops.find((s) => s.type === DeliveryStopType.COLLECTION) || sortedStops[0];
  const deliveryStop = sortedStops.find((s) => s.type === DeliveryStopType.DELIVERY) || sortedStops[sortedStops.length - 1];

  // Cargo metadata aggregated across all collection stops in run
  const allCollectionStops = sortedStops.filter((s) => s.type === DeliveryStopType.COLLECTION);
  const allDeliveryStops = sortedStops.filter((s) => s.type === DeliveryStopType.DELIVERY);
  const totalCargoWeight = allCollectionStops.reduce((sum, s) => {
    const qty = Number(s.orderLine?.quantity);
    if (!isNaN(qty) && qty > 0) return sum + qty;
    if (s.notes) {
      const m = s.notes.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (m && m[1]) return sum + parseFloat(m[1]);
    }
    return sum;
  }, 0);

  const productNames = Array.from(
    new Set(
      allCollectionStops
        .map((s) => s.orderLine?.harvest?.product?.name)
        .filter(Boolean),
    ),
  );
  const firstOrderLine = collectionStop?.orderLine || deliveryStop?.orderLine;
  const productName =
    productNames.length > 0
      ? productNames.join(', ')
      : firstOrderLine?.harvest?.product?.name || 'Tomates Grappes';
  const cargoWeight = totalCargoWeight > 0 ? totalCargoWeight : firstOrderLine?.quantity || 200;
  const productImage = firstOrderLine?.harvest?.photoUrls?.[0] || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=80';

  // Buyer info
  const buyer = firstOrderLine?.order?.buyer;
  const buyerName = buyer ? `${buyer.firstName} ${buyer.lastName}` : 'Jean Dubois';
  const buyerPhone = buyer?.phoneNumber || '06 12 34 56 78';
  const deliveryAddressStr = deliveryStop?.address?.street
    ? `${deliveryStop.address.street}, ${deliveryStop.address.city}`
    : '12 Route de l\'Avenir, Zone Artisanale, 44000 Nantes';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingStopId) {
      uploadProof.mutate({ runId: id, stopId: uploadingStopId, file });
    }
  };

  const handleTriggerUpload = (stopId: string) => {
    setUploadingStopId(stopId);
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (isError || !run) {
    return (
      <div className="text-center py-20 p-6 space-y-3">
        <Icon name="error_outline" className="text-4xl text-rose-500" />
        <p className="text-sm font-bold text-gray-800">Tournée introuvable</p>
        <Link to="/driver/runs" className="text-xs bg-[#004322] text-white px-4 py-2 rounded-lg font-bold inline-block">
          Retour aux tournées
        </Link>
      </div>
    );
  }

  const isInProgress = run.status === DeliveryRunStatus.IN_PROGRESS;
  const isCompleted = run.status === DeliveryRunStatus.COMPLETED;

  return (
    <div className="flex flex-col min-h-screen bg-[#fbfbfe] pb-24">
      {/* Hidden file input for photo proofs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Header - Screen 2 Design */}
      <header className="bg-white px-4 py-3.5 border-b border-gray-100 sticky top-0 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <Link to="/driver" className="p-1 text-[#004322] hover:bg-gray-100 rounded-lg">
            <Icon name="arrow_back" className="text-xl" />
          </Link>
          <span className="font-extrabold text-base tracking-tight text-[#004322]">
            Future Farm Logistic V2.0
          </span>
        </div>

        <Link to="/driver/profile">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.firstName}
              className="w-9 h-9 rounded-full object-cover border-2 border-emerald-600 shadow-2xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-xs border border-emerald-600 shadow-2xs">
              {user?.firstName?.charAt(0) || 'M'}
            </div>
          )}
        </Link>
      </header>

      {/* Embedded Map with "View full map" pill */}
      <div className="relative h-44 w-full bg-gray-100 overflow-hidden border-b border-gray-200">
        <DeliveryMap
          stops={mapStops}
          driverPosition={
            location
              ? { lat: location.lat, lon: location.lon, heading: location.heading }
              : collectionStop
                ? { lat: collectionStop.address.lat, lon: collectionStop.address.lon }
                : null
          }
          className="w-full h-full"
        />

        <Link
          to="/driver/routes"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1 active:scale-95 transition-all z-10"
        >
          <span>View full map</span>
        </Link>
      </div>

      {/* Main Body Content */}
      <main className="p-4 space-y-4 flex-1">
        {/* Order Header & Status */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Commande</p>
            <h2 className="text-xl font-black text-[#0b1c30]">
              Livraison #ORD-{run.id.slice(0, 4).toUpperCase()}
            </h2>
          </div>

          <span
            className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              isInProgress
                ? 'bg-amber-500 text-white shadow-2xs'
                : isCompleted
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Icon name="local_shipping" className="text-sm" />
            {isInProgress ? 'En transit' : isCompleted ? 'Livré' : 'Planifié'}
          </span>
        </div>

        {/* Cargo Detail Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center gap-4">
          <img
            src={productImage}
            alt={productName}
            className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100 shadow-2xs"
          />
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-base text-[#0b1c30] truncate">{productName}</h3>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Poids: {cargoWeight}kg</p>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-700 mt-1">
              <Icon name="schedule" className="text-sm" />
              <span>Arrivée dans 23 min</span>
            </div>
          </div>
        </div>

        {/* Destinataire Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Destinataire</p>
            <h4 className="font-black text-base text-[#0b1c30] truncate mt-0.5">{buyerName}</h4>
            <div className="flex items-start gap-1.5 text-xs text-gray-500 mt-1">
              <Icon name="pin_drop" className="text-sm text-gray-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{deliveryAddressStr}</span>
            </div>
          </div>

          <a
            href={`tel:${buyerPhone}`}
            className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 hover:bg-emerald-200 transition-colors shadow-2xs"
          >
            <Icon name="call" className="text-xl" />
          </a>
        </div>

        {/* Statut de la Route (Vertical Stepper matching Screen 2) */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">
            Statut de la route
          </h3>

          <div className="relative pl-6 space-y-6">
            {/* Step 1: Confirmée */}
            <div className="relative">
              <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
              <div className="ml-2">
                <h4 className="text-sm font-bold text-[#0b1c30]">Confirmée</h4>
                <p className="text-xs text-gray-500">
                  {new Date(run.scheduledAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  - {collectionStop?.address?.city || 'Entrepôt Central'}
                </p>
              </div>
              <span className="absolute -left-4 top-5 w-0.5 h-full bg-emerald-600" />
            </div>

            {/* Step 2: Collecte des produits (tous les points et articles de collecte) */}
            <div className="relative pt-2">
              <span
                className={`absolute -left-6 top-2.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  allCollectionStops.length > 0 &&
                  allCollectionStops.every((s) => s.status === DeliveryStopStatus.COMPLETED)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {allCollectionStops.length > 0 &&
                allCollectionStops.every((s) => s.status === DeliveryStopStatus.COMPLETED)
                  ? '✓'
                  : '●'}
              </span>

              <div className="ml-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#0b1c30]">
                      Points de collecte & Articles ({allCollectionStops.filter((s) => s.status === DeliveryStopStatus.COMPLETED).length}/{allCollectionStops.length})
                    </h4>
                    <p className="text-xs text-gray-500">
                      Vérifiez et confirmez chaque produit un à un chez chaque producteur
                    </p>
                  </div>
                </div>

                {/* List each collection stop / product */}
                <div className="space-y-3">
                  {allCollectionStops.map((stop, idx) => {
                    const orderLine = stop.orderLine;
                    const stopProductName =
                      orderLine?.harvest?.product?.name || `Produit #${idx + 1}`;
                    const stopProductImage =
                      orderLine?.harvest?.photoUrls?.[0] ||
                      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&q=80';
                    const stopQty = Number(orderLine?.quantity) || 0;
                    const stopFarmer = orderLine?.farmerProfile;
                    const stopFarmerName =
                      stopFarmer?.companyName ||
                      (stopFarmer?.user
                        ? `${stopFarmer.user.firstName} ${stopFarmer.user.lastName}`
                        : stop.address?.city || 'Producteur');
                    const stopFarmerPhone = stopFarmer?.user?.phoneNumber;
                    const stopBuyer = orderLine?.order?.buyer;
                    const stopBuyerName = stopBuyer
                      ? `${stopBuyer.firstName} ${stopBuyer.lastName}`
                      : 'Acheteur';
                    const stopDestCity =
                      orderLine?.order?.deliveryAddress?.city ||
                      stop.address?.city ||
                      'Destination';
                    const isStopCompleted = stop.status === DeliveryStopStatus.COMPLETED;
                    const isStopArrived = stop.status === DeliveryStopStatus.ARRIVED;
                    const isStopPending = stop.status === DeliveryStopStatus.PENDING;

                    return (
                      <div
                        key={stop.id}
                        className={`rounded-2xl p-4 border transition-all space-y-3 ${
                          isStopCompleted
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : isStopArrived
                              ? 'bg-[#f8f9ff] border-indigo-200 ring-1 ring-indigo-200'
                              : 'bg-white border-gray-200 shadow-2xs'
                        }`}
                      >
                        {/* Stop Top Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#004322] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <h5 className="font-extrabold text-sm text-[#0b1c30]">
                                {stopFarmerName}
                              </h5>
                              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Icon name="location_on" className="text-xs text-gray-400" />
                                {stop.address?.street ? `${stop.address.street}, ` : ''}
                                {stop.address?.city || 'Lieu de collecte'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {stopFarmerPhone && (
                              <a
                                href={`tel:${stopFarmerPhone}`}
                                className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                title="Appeler le producteur"
                              >
                                <Icon name="call" className="text-xs" />
                              </a>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isStopCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isStopArrived
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isStopCompleted
                                ? '✓ Collecté'
                                : isStopArrived
                                  ? 'Sur place'
                                  : 'À collecter'}
                            </span>
                          </div>
                        </div>

                        {/* Product & Destination Details */}
                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-100">
                          <img
                            src={stopProductImage}
                            alt={stopProductName}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-100 shadow-2xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-1">
                              <p className="font-bold text-xs text-gray-900 truncate">
                                {stopProductName}
                              </p>
                              <span className="font-black text-xs text-emerald-700 shrink-0">
                                {stopQty} kg
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-1 truncate">
                              <Icon name="arrow_forward" className="text-[10px] text-gray-400" />
                              <span>Pour : <strong className="text-gray-700">{stopBuyerName}</strong> ({stopDestCity})</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions & Proof for this item if not yet completed */}
                        {!isStopCompleted && (
                          <div className="space-y-2.5 pt-1 border-t border-gray-100">
                            {/* Photo Proof */}
                            <div>
                              {stop.proofPhotoUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-emerald-300">
                                  <img
                                    src={stop.proofPhotoUrl}
                                    alt="Preuve collecte"
                                    className="w-full h-28 object-cover"
                                  />
                                  <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                    ✓ Photo validée
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTriggerUpload(stop.id)}
                                  className="w-full border-2 border-dashed border-gray-300 hover:border-[#004322] rounded-xl p-3 text-center cursor-pointer transition-colors space-y-0.5 bg-white block"
                                >
                                  <Icon name="photo_camera" className="text-2xl text-gray-400 mx-auto" />
                                  <p className="font-bold text-xs text-gray-800">
                                    Prendre la photo du produit *
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    Photo requise pour certifier l'état
                                  </p>
                                </button>
                              )}
                            </div>

                            {/* Inspection Report Button (Active once arrived) */}
                            {isStopArrived && (
                              <button
                                type="button"
                                onClick={() => setPickupReportStopId(stop.id)}
                                className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                  stop.pickupReport?.status === 'SUBMITTED'
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                    : 'bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                                }`}
                              >
                                <Icon
                                  name={
                                    stop.pickupReport?.status === 'SUBMITTED'
                                      ? 'task_alt'
                                      : 'assignment'
                                  }
                                  className="text-sm"
                                />
                                {stop.pickupReport?.status === 'SUBMITTED'
                                  ? '✓ Rapport de contrôle certifié'
                                  : 'Remplir le rapport de contrôle qualité *'}
                              </button>
                            )}

                            {/* Primary Action Button per item */}
                            <div className="flex gap-2">
                              {isStopPending ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    arriveStop.mutate({ runId: id, stopId: stop.id })
                                  }
                                  className="w-full py-2.5 bg-[#004322] hover:bg-[#00331a] text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                                >
                                  <Icon name="pin_drop" className="text-sm" />
                                  Confirmer mon arrivée chez ce producteur
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    completeStop.mutate({ runId: id, stopId: stop.id })
                                  }
                                  disabled={
                                    !stop.proofPhotoUrl ||
                                    stop.pickupReport?.status !== 'SUBMITTED' ||
                                    completeStop.isPending
                                  }
                                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                                    stop.proofPhotoUrl &&
                                    stop.pickupReport?.status === 'SUBMITTED' &&
                                    !completeStop.isPending
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  <Icon name="check_circle" className="text-sm" />
                                  Valider la collecte de cet article
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <span className="absolute -left-4 top-7 w-0.5 h-full bg-gray-200" />
            </div>

            {/* Step 3: En transit */}
            <div className="relative pt-2">
              <span
                className={`absolute -left-6 top-2.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isInProgress ? 'bg-amber-500 text-white animate-pulse' : isCompleted ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-white'
                }`}
              >
                {isCompleted ? '✓' : '●'}
              </span>
              <div className="ml-2 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-[#0b1c30]">En transit</h4>
                  <p className="text-xs text-gray-500">
                    {allCollectionStops.length > 0 &&
                    allCollectionStops.every((s) => s.status === DeliveryStopStatus.COMPLETED)
                      ? isInProgress
                        ? 'Transit en cours. En route vers les clients destinataires.'
                        : 'Toutes les collectes sont effectuées. Prêt à démarrer le transit.'
                      : 'Collecte des articles chez les producteurs en cours'}
                  </p>
                </div>

                {/* Prominent Start Transit Button */}
                {!isCompleted &&
                  allCollectionStops.length > 0 &&
                  allCollectionStops.every((s) => s.status === DeliveryStopStatus.COMPLETED) && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                        <Icon name="local_shipping" className="text-base text-amber-600" />
                        <span>Tous les produits ont été collectés avec succès !</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-snug">
                        Cliquez ci-dessous pour démarrer le transport. Cela passera tous les articles en transit et notifiera directement les acheteurs.
                      </p>
                      <button
                        type="button"
                        onClick={() => startTransit.mutate(id)}
                        disabled={startTransit.isPending}
                        className="w-full py-2.5 bg-[#004322] hover:bg-[#00331a] active:scale-98 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Icon name="play_arrow" className="text-base" />
                        {startTransit.isPending ? 'Démarrage du transit...' : 'Démarrer le transit vers les clients'}
                      </button>
                    </div>
                  )}
              </div>
              <span className="absolute -left-4 top-7 w-0.5 h-full bg-gray-200" />
            </div>

            {/* Step 4: Livraisons aux destinataires */}
            <div className="relative pt-2">
              <span
                className={`absolute -left-6 top-2.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCompleted ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted ? '✓' : '○'}
              </span>
              <div className="ml-2 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-[#0b1c30]">
                    Livraison aux destinataires ({sortedStops.filter((s) => s.type === DeliveryStopType.DELIVERY && s.status === DeliveryStopStatus.COMPLETED).length}/{sortedStops.filter((s) => s.type === DeliveryStopType.DELIVERY).length})
                  </h4>
                  <p className="text-xs text-gray-400">Preuve de livraison requise pour chaque destinataire</p>
                </div>

                {/* Delivery Stops List */}
                <div className="space-y-3">
                  {sortedStops
                    .filter((s) => s.type === DeliveryStopType.DELIVERY)
                    .map((dStop, dIdx) => {
                      const dOrderLine = dStop.orderLine;
                      const dBuyer = dOrderLine?.order?.buyer;
                      const dBuyerName = dBuyer
                        ? `${dBuyer.firstName} ${dBuyer.lastName}`
                        : 'Destinataire';
                      const dBuyerPhone = dBuyer?.phoneNumber;
                      const dAddrStr = dStop.address?.street
                        ? `${dStop.address.street}, ${dStop.address.city}`
                        : dStop.address?.city || 'Adresse de livraison';
                      const isDCompleted = dStop.status === DeliveryStopStatus.COMPLETED;
                      const isDArrived = dStop.status === DeliveryStopStatus.ARRIVED;
                      const isDPending = dStop.status === DeliveryStopStatus.PENDING;
                      const dProdName = dOrderLine?.harvest?.product?.name || 'Produit';
                      const dQty = Number(dOrderLine?.quantity) || 0;

                      return (
                        <div
                          key={dStop.id}
                          className={`rounded-2xl p-4 border transition-all space-y-2.5 ${
                            isDCompleted
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : isDArrived
                                ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-200'
                                : 'bg-white border-gray-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                Destinataire #{dIdx + 1}
                              </span>
                              <h5 className="font-extrabold text-sm text-[#0b1c30]">{dBuyerName}</h5>
                              <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                                <Icon name="pin_drop" className="text-xs text-gray-400" />
                                {dAddrStr}
                              </p>
                              <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                                Colis : {dProdName} ({dQty} kg)
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {dBuyerPhone && (
                                <a
                                  href={`tel:${dBuyerPhone}`}
                                  className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                                  title="Appeler le destinataire"
                                >
                                  <Icon name="call" className="text-xs" />
                                </a>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isDCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isDArrived
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {isDCompleted ? '✓ Livré' : isDArrived ? 'Arrivé' : 'En attente'}
                              </span>
                            </div>
                          </div>

                          {!isDCompleted && (
                            <div className="pt-2 border-t border-gray-100 space-y-2">
                              {dStop.proofPhotoUrl ? (
                                <div className="relative rounded-xl overflow-hidden border border-emerald-300">
                                  <img
                                    src={dStop.proofPhotoUrl}
                                    alt="Preuve livraison"
                                    className="w-full h-24 object-cover"
                                  />
                                  <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                    ✓ Preuve capturée
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTriggerUpload(dStop.id)}
                                  className="w-full border-2 border-dashed border-gray-300 hover:border-[#004322] rounded-xl p-2.5 text-center cursor-pointer transition-colors space-y-0.5 bg-white block"
                                >
                                  <Icon name="photo_camera" className="text-xl text-gray-400 mx-auto" />
                                  <p className="font-bold text-xs text-gray-800">
                                    Prendre la photo de livraison *
                                  </p>
                                </button>
                              )}

                              <div className="flex gap-2">
                                {isDPending ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      arriveStop.mutate({ runId: id, stopId: dStop.id })
                                    }
                                    className="w-full py-2.5 bg-[#004322] hover:bg-[#00331a] text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                                  >
                                    <Icon name="pin_drop" className="text-sm" />
                                    Confirmer l'arrivée chez le destinataire
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      completeStop.mutate({ runId: id, stopId: dStop.id })
                                    }
                                    disabled={!dStop.proofPhotoUrl || completeStop.isPending}
                                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                                      dStop.proofPhotoUrl && !completeStop.isPending
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                  >
                                    <Icon name="check_circle" className="text-sm" />
                                    Marquer comme livré
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Complete Run Button in Step 4 when all deliveries done */}
                {!isCompleted &&
                  allDeliveryStops.length > 0 &&
                  allDeliveryStops.every(
                    (s) =>
                      s.status === DeliveryStopStatus.COMPLETED ||
                      s.status === DeliveryStopStatus.SKIPPED,
                  ) && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 mt-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                        <Icon name="verified" className="text-base text-emerald-600" />
                        <span>Toutes les livraisons sont terminées !</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 leading-snug">
                        Vous pouvez maintenant clôturer cette tournée. Cela mettra à jour les commandes correspondantes et avertira les acheteurs.
                      </p>
                      <button
                        type="button"
                        onClick={() => completeRun.mutate(id)}
                        disabled={completeRun.isPending}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-extrabold cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Icon name="check_circle" className="text-base" />
                        {completeRun.isPending ? 'Clôture en cours...' : 'Terminer la tournée'}
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Action button: Terminer la tournée (sticky / bottom) when deliveries are done */}
        {!isCompleted &&
          allDeliveryStops.length > 0 &&
          allDeliveryStops.every(
            (s) =>
              s.status === DeliveryStopStatus.COMPLETED ||
              s.status === DeliveryStopStatus.SKIPPED,
          ) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => completeRun.mutate(id)}
                disabled={completeRun.isPending}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-extrabold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Icon name="task_alt" className="text-lg" />
                <span>{completeRun.isPending ? 'Finalisation...' : 'Terminer la tournée'}</span>
              </button>
            </div>
          )}

        {/* Issue Reporting Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (currentActiveStop) {
                setSkippingStopId(currentActiveStop.id);
              }
            }}
            className="w-full py-3.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-2xl font-bold text-xs active:scale-98 transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
          >
            <Icon name="error_outline" className="text-base text-rose-600" />
            <span>Signaler un problème sur l'arrêt en cours</span>
          </button>
        </div>
      </main>

      {/* Skip Stop / Report Modal */}
      {skippingStopId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-slide-in">
            <h3 className="font-bold text-base text-gray-900">Signaler un problème sur l'arrêt</h3>
            <p className="text-xs text-gray-500">
              Précisez le problème rencontré (ex: destinataire absent, produit endommagé, route impraticable).
            </p>

            <textarea
              rows={3}
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Description détaillée du problème..."
              className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#004322] focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSkippingStopId(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (skipReason.trim()) {
                    skipStop.mutate({
                      runId: id,
                      stopId: skippingStopId,
                      dto: { reason: skipReason },
                    });
                  }
                }}
                disabled={!skipReason.trim() || skipStop.isPending}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {skipStop.isPending ? 'Enregistrement...' : 'Confirmer le signalement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pickup Report Modal for COLLECTION stops */}
      {pickupReportStopId && (() => {
        const targetStop = run.stops?.find((s) => s.id === pickupReportStopId);
        const orderLine = targetStop?.orderLine;
        const targetWeight = Number(orderLine?.quantity) || 0;
        const targetProduct = orderLine?.harvest?.product?.name;
        const farmer = orderLine?.farmerProfile;
        const targetFarmerName =
          farmer?.companyName ||
          (farmer?.user ? `${farmer.user.firstName} ${farmer.user.lastName}` : targetStop?.address?.city);
        const targetDestCity =
          orderLine?.order?.deliveryAddress?.city || targetStop?.address?.city;

        return (
          <PickupReportModal
            runId={id}
            stopId={pickupReportStopId}
            initialWeight={targetWeight}
            productName={targetProduct}
            farmerName={targetFarmerName}
            destinationCity={targetDestCity}
            onClose={() => setPickupReportStopId(null)}
            onSuccess={() => void refetch()}
          />
        );
      })()}
    </div>
  );
}
