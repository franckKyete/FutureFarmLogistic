import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getOrderDetailsQuery } from '@/features/orders/api/buyer-orders.queries';
import { useDeliveryRuns } from '@/features/admin/api/logistics.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useOrderTracking } from '@/features/shared/hooks/useOrderTracking';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { addToast } from '@/features/shared/store/toast.store';
import { OrderStatus, DeliveryRunStatus } from '@futurefarm/types';

export const Route = createFileRoute('/orders/$id/tracking')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrderTrackingPage,
});

function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OrderTrackingPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: order, isLoading: orderLoading, isError } = useQuery(getOrderDetailsQuery(id));
  const { data: runs = [] } = useDeliveryRuns();

  // Find delivery run that contains stops for any line of this order
  const matchedRun = useMemo(() => {
    if (order?.delivery?.runId) {
      return {
        id: order.delivery.runId,
        scheduledAt: order.delivery.scheduledAt,
        status: order.delivery.runStatus || 'PLANNED',
        driver: order.delivery.driverName
          ? {
              id: 'driver-id',
              firstName: order.delivery.driverName.split(' ')[0] || '',
              lastName: order.delivery.driverName.split(' ').slice(1).join(' ') || '',
              phoneNumber: order.delivery.driverPhone,
              avatarUrl: (order.delivery as any).driverAvatarUrl,
            }
          : null,
        stops: (order.delivery as any).stops || [],
        vehiclePlate: order.delivery.vehiclePlate,
        vehicleType: order.delivery.vehicleType,
      };
    }
    if (!order || !order.lines || runs.length === 0) return null;
    const orderLineIds = new Set(order.lines.map((l) => l.id));
    return runs.find((r) => r.stops?.some((s) => orderLineIds.has(s.orderLineId))) || null;
  }, [order, runs]);

  // Use security-focused obfuscated location stream scoped to this specific order
  const { location } = useOrderTracking(id);

  // Real destination coordinates from order deliveryAddress
  const destCoord = useMemo<[number, number] | null>(() => {
    const addr = order?.deliveryAddress as any;
    const lat = Number(addr?.latitude ?? addr?.lat);
    const lon = Number(addr?.longitude ?? addr?.lon);
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      return [lat, lon];
    }
    return null;
  }, [order?.deliveryAddress]);

  // Real stops from delivery run, or delivery destination
  const stops: MapStop[] = useMemo(() => {
    const allStops: MapStop[] = [];
    const runStops = matchedRun?.stops || (order?.delivery as any)?.stops || [];

    runStops.forEach((s: any) => {
      const lat = Number(s.address?.latitude ?? s.address?.lat);
      const lon = Number(s.address?.longitude ?? s.address?.lon);
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        allStops.push({
          id: s.id,
          lat,
          lon,
          label: s.address?.city || s.address?.street || (s.type === 'COLLECTION' ? 'Collecte' : 'Livraison'),
          type: s.type as 'COLLECTION' | 'DELIVERY',
          status: s.status,
        });
      }
    });

    if (!allStops.some((s) => s.type === 'DELIVERY') && destCoord) {
      allStops.push({
        id: 'order-dest',
        lat: destCoord[0],
        lon: destCoord[1],
        label: (order?.deliveryAddress as any)?.city || (order?.deliveryAddress as any)?.streetAddress || 'Lieu de livraison',
        type: 'DELIVERY',
        status: order?.status === OrderStatus.DELIVERED ? 'COMPLETED' : 'PENDING',
      });
    }

    return allStops;
  }, [matchedRun, order, destCoord]);

  // Real route polyline from optimized route coordinates if available
  const routePolyline: [number, number][] | undefined = useMemo(() => {
    const routeCoords = (matchedRun as any)?.optimisedRoute?.coordinates;
    if (routeCoords && routeCoords.length > 1) {
      return routeCoords.map(([lon, lat]: [number, number]) => [lat, lon]);
    }
    if (stops.length > 1) {
      return stops.map((s) => [s.lat, s.lon]);
    }
    return undefined;
  }, [matchedRun, stops]);

  // Driver real-time position from live stream (no fake default coordinates)
  const driverPosition = useMemo(() => {
    if (location && !isNaN(location.lat) && !isNaN(location.lon) && location.lat !== 0 && location.lon !== 0) {
      return { lat: location.lat, lon: location.lon, heading: location.heading ?? 0 };
    }
    return null;
  }, [location]);

  // Driver details (Real data only, no fake placeholders)
  const driverFullName = useMemo(() => {
    if (order?.delivery?.driverName) return order.delivery.driverName;
    if (matchedRun?.driver) {
      return `${matchedRun.driver.firstName} ${matchedRun.driver.lastName}`.trim();
    }
    return null;
  }, [order?.delivery?.driverName, matchedRun?.driver]);

  const driverPhone = useMemo(() => {
    if (order?.delivery?.driverPhone) return order.delivery.driverPhone;
    const runDriver = matchedRun?.driver as any;
    if (runDriver?.phoneNumber) return runDriver.phoneNumber;
    return null;
  }, [order?.delivery?.driverPhone, matchedRun?.driver]);

  const driverAvatarUrl = useMemo(() => {
    return (order?.delivery as any)?.driverAvatarUrl || (matchedRun?.driver as any)?.avatarUrl || null;
  }, [order?.delivery, matchedRun?.driver]);

  const driverRating = useMemo(() => {
    return (order?.delivery as any)?.driverRating ?? (matchedRun?.driver as any)?.averageRating ?? null;
  }, [order?.delivery, matchedRun?.driver]);

  const vehiclePlate = useMemo(() => {
    return order?.delivery?.vehiclePlate || (matchedRun as any)?.vehiclePlate || (matchedRun as any)?.vehicle?.registrationPlate || null;
  }, [order?.delivery, matchedRun]);

  const orderNumberFormatted = order
    ? `#ORD-${order.id.slice(0, 8).toUpperCase()}`
    : '';

  // Real product summary
  const productSummary = useMemo(() => {
    if (!order?.lines || order.lines.length === 0) return 'Articles maraîchers';
    const names = order.lines.map((l) => l.harvest?.product?.name).filter(Boolean);
    const uniqueNames = Array.from(new Set(names));
    if (uniqueNames.length === 0) return `${order.lines.length} article(s)`;
    if (uniqueNames.length <= 2) return uniqueNames.join(', ');
    return `${uniqueNames.slice(0, 2).join(', ')} +${uniqueNames.length - 2}`;
  }, [order?.lines]);

  const totalQuantityKg = useMemo(() => {
    return order?.lines?.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0) || 0;
  }, [order?.lines]);

  // Order progression state
  const isDelivered = order?.status === OrderStatus.DELIVERED;
  const isShipped = order?.status === OrderStatus.SHIPPED || isDelivered;
  const isRunInProgress = matchedRun?.status === DeliveryRunStatus.IN_PROGRESS;

  if (orderLoading) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff]">
        <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Link to="/orders" className="p-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center">
              <Icon name="arrow_back" className="text-[20px]" />
            </Link>
            <span className="font-extrabold text-[#004322] text-base tracking-tight">Future Farm</span>
          </div>
          <div className="w-8" />
        </header>
        <main className="pt-20 px-4 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#004322] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#707970]">Chargement du suivi de livraison...</p>
        </main>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-[#f8f9ff] pt-20 px-4 text-center">
        <div className="py-16 bg-white rounded-2xl border border-[#c0c9be] p-6 shadow-xs">
          <Icon name="error_outline" className="text-4xl text-gray-400 mb-2 block" />
          <p className="text-sm text-[#0b1c30] font-bold">Impossible de charger le suivi</p>
          <p className="text-xs text-[#707970] mt-1">
            Les détails de cette commande sont introuvables.
          </p>
          <Link
            to="/orders"
            className="mt-4 inline-block px-4 py-2 bg-[#004322] text-white text-xs font-bold rounded-xl"
          >
            Retour aux commandes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] relative pb-10 max-w-[480px] mx-auto">
      {/* ── 1. FIXED TOP HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/orders/$id"
            params={{ id }}
            className="p-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center cursor-pointer"
            aria-label="Retour aux détails de la commande"
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </Link>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-300 shrink-0 bg-[#004322] text-white flex items-center justify-center font-bold text-xs">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Profil"
                className="w-full h-full object-cover"
              />
            ) : (
              user?.firstName?.charAt(0) || 'U'
            )}
          </div>
          <span className="font-extrabold text-[#004322] text-base tracking-tight truncate">
            Future Farm
          </span>
        </div>

        <Link
          to="/notifications"
          className="p-1.5 text-[#404941] hover:text-[#004322] hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Icon name="notifications" className="text-[22px]" />
        </Link>
      </header>

      {/* ── 2. MAP AREA ── */}
      <div className="pt-14 relative w-full h-[320px] bg-[#eef3ee] overflow-hidden">
        {/* Floating status badge */}
        <div className="absolute top-16 left-3 z-10 bg-white/90 backdrop-blur-sm text-[#004322] px-2.5 py-1.5 rounded-lg shadow-sm border border-[#c0c9be]/50 flex items-center gap-1.5 text-xs font-bold">
          <Icon name="local_shipping" className="text-[16px]" />
          <span>{isDelivered ? 'Livrée' : isShipped ? 'En route' : 'En préparation'}</span>
        </div>

        {/* Real Interactive Leaflet Map */}
        <DeliveryMap
          driverPosition={driverPosition}
          driverName={driverFullName || 'Transporteur'}
          stops={stops}
          routePolyline={routePolyline}
          defaultCenter={destCoord || undefined}
          defaultZoom={destCoord ? 13 : 11}
          className="h-full w-full relative z-0"
        />

        {/* Bottom smooth gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#f8f9ff] via-[#f8f9ff]/70 to-transparent pointer-events-none z-10" />
      </div>

      {/* ── 3. CONTENT STACK (CARDS + TIMELINE + ACTIONS) ── */}
      <div className="-mt-6 relative z-20 space-y-4 px-4">
        {/* Card 1: Estimated Arrival & Scheduling */}
        <div
          data-testid="estimated-arrival-card"
          className="bg-white rounded-2xl border border-[#c0c9be] p-4 shadow-sm space-y-3"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider block">
                SUIVI DE LIVRAISON
              </span>
              {matchedRun?.scheduledAt && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {new Date(matchedRun.scheduledAt).toLocaleDateString('fr-FR', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#004322] tracking-tight mt-0.5">
              {isDelivered
                ? 'Commande livrée'
                : isRunInProgress
                  ? 'En cours de livraison'
                  : matchedRun?.scheduledAt
                    ? `Prévu le ${new Date(matchedRun.scheduledAt).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })} vers ${new Date(matchedRun.scheduledAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'Planification logistique en cours'}
            </h1>
          </div>

          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
            <Icon name="info" className="text-emerald-700 text-[16px] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-emerald-950">Statut de la tournée</span>
              {driverFullName
                ? `Tournée planifiée avec ${driverFullName}${vehiclePlate ? ` (${vehiclePlate})` : ''}.`
                : 'Votre commande est confirmée. Un chauffeur dédié sera assigné dès la finalisation du chargement.'}
            </div>
          </div>

          <div className="h-px bg-[#e2e8f0]" />

          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <div>
              <span className="text-[11px] font-semibold text-[#707970] block">N° Commande</span>
              <span className="text-sm font-black text-[#0b1c30]">{orderNumberFormatted}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#707970] block">Contenu</span>
              <span className="text-sm font-bold text-[#0b1c30] truncate block" title={productSummary}>
                {productSummary} {totalQuantityKg > 0 ? `(${totalQuantityKg} kg)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Driver Info */}
        <div
          data-testid="driver-info-card"
          className="bg-white rounded-2xl border border-[#c0c9be] p-3.5 shadow-xs flex items-center justify-between gap-3"
        >
          {driverFullName ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                {driverAvatarUrl ? (
                  <img
                    src={driverAvatarUrl}
                    alt={driverFullName}
                    className="w-12 h-12 rounded-xl object-cover border border-[#c0c9be]/60 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-black text-sm shrink-0">
                    {driverFullName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-[#0b1c30] truncate">{driverFullName}</h2>
                  <p className="text-[11px] text-gray-500 font-medium truncate">
                    {vehiclePlate ? `Véhicule : ${vehiclePlate}` : 'Chauffeur Future Farm'}
                  </p>
                  {driverRating != null && (
                    <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 mt-0.5">
                      <span>★</span>
                      <span>{Number(driverRating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {driverPhone ? (
                <a
                  href={`tel:${driverPhone}`}
                  aria-label="Appeler le chauffeur"
                  data-testid="driver-phone-btn"
                  className="w-10 h-10 rounded-full bg-white hover:bg-emerald-50 text-[#004322] flex items-center justify-center border border-[#c0c9be] shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Appeler le chauffeur"
                >
                  <Icon name="call" className="text-[19px]" />
                </a>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center border border-gray-200 shrink-0">
                  <Icon name="call" className="text-[19px]" />
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 py-1 text-gray-600">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                <Icon name="person" className="text-xl" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Chauffeur en cours d'attribution</p>
                <p className="text-[11px] text-gray-500">
                  Un transporteur vous sera affecté lors de la prise en charge.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Order Progress Timeline */}
        <div
          data-testid="order-progress-card"
          className="bg-white rounded-2xl border border-[#c0c9be] p-4 shadow-sm space-y-3"
        >
          <h2 className="text-xs font-extrabold text-[#707970] uppercase tracking-wider">
            Progression de la livraison
          </h2>

          <div className="space-y-0 relative pl-1">
            {/* Step 1: Order Confirmed */}
            <div className="flex items-start gap-3 relative pb-6">
              <div className={`absolute left-[7px] top-3 bottom-0 w-[2px] ${isShipped || isDelivered ? 'bg-[#004322]' : 'bg-[#e2e8f0]'}`} />
              <div className="w-4 h-4 rounded-full bg-[#004322] flex items-center justify-center shrink-0 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Commande validée</p>
                <p className="text-[11px] text-[#707970]">
                  {formatDateTime(order.createdAt)}
                </p>
              </div>
            </div>

            {/* Step 2: Picked up / Prepared */}
            <div className="flex items-start gap-3 relative pb-6">
              <div className={`absolute left-[7px] top-3 bottom-0 w-[2px] ${isDelivered ? 'bg-[#004322]' : isShipped ? 'bg-emerald-500' : 'bg-[#e2e8f0]'}`} />
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 z-10 ${
                isShipped || isDelivered || order.status === OrderStatus.CONFIRMED ? 'bg-[#004322]' : 'bg-[#c0c9be]'
              }`}>
                {(isShipped || isDelivered || order.status === OrderStatus.CONFIRMED) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Collecte & Préparation</p>
                <p className="text-[11px] text-[#707970]">
                  {isShipped || isDelivered
                    ? 'Récoltes collectées auprès des producteurs'
                    : order.status === OrderStatus.CONFIRMED
                      ? 'Articles prêts pour la collecte par le transporteur'
                      : 'Préparation et emballage des lots'}
                </p>
              </div>
            </div>

            {/* Step 3: In Transit */}
            <div className="flex items-start gap-3 relative pb-6">
              <div className={`absolute left-[7px] top-3 bottom-0 w-[2px] ${isDelivered ? 'bg-[#004322]' : 'bg-[#e2e8f0]'}`} />
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 z-10 ${
                isDelivered
                  ? 'bg-[#004322]'
                  : isRunInProgress || isShipped
                    ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                    : 'bg-[#c0c9be]'
              }`}>
                {isDelivered && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Acheminement</p>
                <p className="text-[11px] text-[#707970] font-medium">
                  {isDelivered
                    ? 'Trajet terminé'
                    : isRunInProgress
                      ? 'Camion en route vers votre adresse'
                      : 'Tournée en cours d\'organisation'}
                </p>
              </div>
            </div>

            {/* Step 4: Delivered */}
            <div className="flex items-start gap-3 relative">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 z-10 ${
                isDelivered ? 'bg-[#004322]' : 'bg-[#c0c9be]'
              }`}>
                {isDelivered && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className={`text-xs font-bold ${isDelivered ? 'text-[#004322]' : 'text-[#707970]'}`}>
                  {isDelivered ? 'Livrée' : 'Livraison finale'}
                </p>
                <p className="text-[11px] text-[#707970]">
                  {(order.deliveryAddress as any)?.city
                    ? `Destination : ${(order.deliveryAddress as any).city}`
                    : 'Remise en main propre'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          {driverPhone ? (
            <a
              href={`tel:${driverPhone}`}
              data-testid="contact-driver-btn"
              className="w-full bg-[#004322] hover:bg-[#1a5c35] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <Icon name="chat" className="text-[19px]" />
              <span>Contacter le chauffeur</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              data-testid="contact-driver-btn"
              className="w-full bg-gray-100 text-gray-400 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs cursor-not-allowed"
            >
              <Icon name="chat" className="text-[19px]" />
              <span>Chauffeur non assigné</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => addToast('Signalement transmis au support logistique.', 'info')}
            data-testid="report-issue-btn"
            className="w-full bg-white hover:bg-rose-50/60 border border-rose-300 text-rose-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <Icon name="error_outline" className="text-[19px] text-rose-600" />
            <span>Signaler un problème</span>
          </button>
        </div>
      </div>
    </div>
  );
}
