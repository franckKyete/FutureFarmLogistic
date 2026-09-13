import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getOrderDetailsQuery } from '@/features/orders/api/buyer-orders.queries';
import { useDeliveryRuns } from '@/features/admin/api/logistics.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useDeliveryMap } from '@/features/shared/hooks/useDeliveryMap';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/orders/$id/tracking')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrderTrackingPage,
});

function formatTime(isoString?: string): string {
  if (!isoString) return '09:12 AM';
  const d = new Date(isoString);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
  return `Today, ${formattedHours}:${minutes} ${ampm}`;
}

export function OrderTrackingPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: order, isLoading: orderLoading, isError } = useQuery(getOrderDetailsQuery(id));
  const { data: runs = [] } = useDeliveryRuns();

  // Find delivery run that contains stops for any line of this order
  const matchedRun = useMemo(() => {
    if (!order || !order.lines || runs.length === 0) return null;
    const orderLineIds = new Set(order.lines.map((l) => l.id));
    return runs.find((r) => r.stops?.some((s) => orderLineIds.has(s.orderLineId))) || null;
  }, [order, runs]);

  const { location } = useDeliveryMap(matchedRun?.id);

  // Fallback coordinates around Dakar / Rufisque
  const fallbackFarmCoord: [number, number] = useMemo(() => [14.795, -17.32], []);
  const fallbackDestCoord: [number, number] = useMemo(() => {
    const addr = order?.deliveryAddress as { lat?: number; lon?: number } | undefined;
    if (addr?.lat && addr?.lon) {
      return [addr.lat, addr.lon];
    }
    return [14.7167, -17.4677];
  }, [order?.deliveryAddress]);

  const stops: MapStop[] = useMemo(() => {
    if (!matchedRun?.stops || matchedRun.stops.length === 0) {
      return [
        {
          id: 'farm-pickup',
          lat: fallbackFarmCoord[0],
          lon: fallbackFarmCoord[1],
          label: 'Ferme - Point de collecte',
          type: 'COLLECTION',
          status: 'COMPLETED',
        },
        {
          id: 'order-dest',
          lat: fallbackDestCoord[0],
          lon: fallbackDestCoord[1],
          label: order?.deliveryAddress?.city || 'Destination de livraison',
          type: 'DELIVERY',
          status: 'PENDING',
        },
      ];
    }

    return matchedRun.stops.map((s) => ({
      id: s.id,
      lat: s.address.lat,
      lon: s.address.lon,
      label: s.address.city || s.address.street || 'Arrêt',
      type: s.type as 'COLLECTION' | 'DELIVERY',
      status: s.status,
    }));
  }, [matchedRun, order, fallbackFarmCoord, fallbackDestCoord]);

  const routePolyline: [number, number][] = useMemo(() => {
    const routeCoords = (matchedRun as any)?.optimisedRoute?.coordinates;
    if (routeCoords && routeCoords.length > 1) {
      return routeCoords.map(([lon, lat]: [number, number]) => [lat, lon]);
    }
    // Interpolated route between farm and destination
    const [lat1, lon1] = fallbackFarmCoord;
    const [lat2, lon2] = fallbackDestCoord;
    return [
      [lat1, lon1],
      [lat1 - (lat1 - lat2) * 0.25, lon1 - (lon1 - lon2) * 0.25],
      [lat1 - (lat1 - lat2) * 0.5, lon1 - (lon1 - lon2) * 0.5],
      [lat1 - (lat1 - lat2) * 0.75, lon1 - (lon1 - lon2) * 0.75],
      [lat2, lon2],
    ];
  }, [matchedRun, fallbackFarmCoord, fallbackDestCoord]);

  const driverPosition = useMemo(() => {
    if (location && !isNaN(location.lat) && !isNaN(location.lon)) {
      return { lat: location.lat, lon: location.lon, heading: location.heading ?? 45 };
    }
    // Midpoint on route
    const midLat = fallbackFarmCoord[0] - (fallbackFarmCoord[0] - fallbackDestCoord[0]) * 0.5;
    const midLon = fallbackFarmCoord[1] - (fallbackFarmCoord[1] - fallbackDestCoord[1]) * 0.5;
    return { lat: midLat, lon: midLon, heading: 45 };
  }, [location, fallbackFarmCoord, fallbackDestCoord]);

  const driverFullName =
    (matchedRun?.driver ? `${matchedRun.driver.firstName} ${matchedRun.driver.lastName.slice(0, 1)}.` : null) ||
    order?.delivery?.driverName ||
    'Amadou K.';

  const driverPhone =
    order?.delivery?.driverPhone ||
    (matchedRun?.driver as any)?.phoneNumber ||
    '+221 77 123 45 67';

  const driverAvatarUrl =
    (matchedRun?.driver as any)?.avatarUrl ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256';

  const orderNumberFormatted = order
    ? `#FF-${order.id.slice(0, 5).toUpperCase()}-B`
    : '#FF-92841-B';

  const batchQualityLabel =
    order?.lines?.[0]?.harvest?.farmingMethods?.toLowerCase().includes('bio')
      ? 'Grade A'
      : 'Grade A';

  const etaMinutes = 23;

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
    <div className="min-h-screen bg-[#f8f9ff] relative pb-24">
      {/* ── 1. FIXED TOP HEADER ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#e2e8f0] h-14 max-w-[480px] mx-auto px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/orders/$id"
            params={{ id }}
            className="p-1 rounded-lg text-[#004322] hover:bg-gray-100 flex items-center"
            aria-label="Retour aux détails de la commande"
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </Link>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-300 shrink-0">
            <img
              src={(user as any)?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=128'}
              alt="Profil"
              className="w-full h-full object-cover"
            />
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
        {/* Floating truck badge in top-left */}
        <div className="absolute top-16 left-3 z-10 bg-white/90 backdrop-blur-sm text-[#004322] p-1.5 rounded-lg shadow-sm border border-[#c0c9be]/50 flex items-center justify-center">
          <Icon name="local_shipping" className="text-[18px]" />
        </div>

        {/* Real Interactive Leaflet Map */}
        <DeliveryMap
          driverPosition={driverPosition}
          driverName={driverFullName}
          stops={stops}
          routePolyline={routePolyline}
          className="h-full w-full relative z-0"
        />

        {/* Bottom smooth gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#f8f9ff] via-[#f8f9ff]/70 to-transparent pointer-events-none z-10" />
      </div>

      {/* ── 3. CONTENT STACK (CARDS + TIMELINE + ACTIONS) ── */}
      <div className="-mt-8 relative z-20 space-y-4 px-4">
        {/* Card 1: Estimated Arrival */}
        <div
          data-testid="estimated-arrival-card"
          className="bg-white rounded-2xl border border-[#c0c9be] p-4 shadow-sm space-y-3"
        >
          <div>
            <span className="text-[10px] font-extrabold text-[#707970] uppercase tracking-wider block">
              ESTIMATED ARRIVAL
            </span>
            <h1 className="text-2xl sm:text-[26px] font-black text-[#004322] tracking-tight mt-0.5">
              Arrives in {etaMinutes} minutes
            </h1>
          </div>

          <div className="h-px bg-[#e2e8f0]" />

          <div className="grid grid-cols-2 gap-3 pt-0.5">
            <div>
              <span className="text-[11px] font-semibold text-[#707970] block">Order Number</span>
              <span className="text-sm font-black text-[#0b1c30]">{orderNumberFormatted}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#707970] block">Batch Quality</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-black text-[#0b1c30]">{batchQualityLabel}</span>
                <span className="w-2 h-2 rounded-full bg-[#004322] shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Driver Info */}
        <div
          data-testid="driver-info-card"
          className="bg-white rounded-2xl border border-[#c0c9be] p-3.5 shadow-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={driverAvatarUrl}
              alt={driverFullName}
              className="w-12 h-12 rounded-xl object-cover border border-[#c0c9be]/60 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0b1c30] truncate">{driverFullName}</h2>
              <div className="flex items-center gap-1 text-xs font-semibold text-[#885200] mt-0.5">
                <span className="text-amber-500 text-sm leading-none">★</span>
                <span>4.8 Rating</span>
              </div>
            </div>
          </div>

          <a
            href={`tel:${driverPhone}`}
            aria-label="Appeler le chauffeur"
            data-testid="driver-phone-btn"
            className="w-10 h-10 rounded-full bg-white hover:bg-emerald-50 text-[#004322] flex items-center justify-center border border-[#c0c9be] shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Icon name="call" className="text-[19px]" />
          </a>
        </div>

        {/* Order Progress Timeline */}
        <div
          data-testid="order-progress-card"
          className="space-y-3 pt-1"
        >
          <h2 className="text-xs font-extrabold text-[#707970] uppercase tracking-wider">
            Order Progress
          </h2>

          <div className="space-y-0 relative pl-1">
            {/* Step 1: Order Confirmed */}
            <div className="flex items-start gap-3 relative pb-6">
              <div className="absolute left-[7px] top-3 bottom-0 w-[2px] bg-[#004322]" />
              <div className="w-4 h-4 rounded-full bg-[#004322] flex items-center justify-center shrink-0 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Order Confirmed</p>
                <p className="text-[11px] text-[#707970]">
                  {formatTime(order.createdAt)}
                </p>
              </div>
            </div>

            {/* Step 2: Picked up */}
            <div className="flex items-start gap-3 relative pb-6">
              <div className="absolute left-[7px] top-3 bottom-0 w-[2px] bg-[#004322]" />
              <div className="w-4 h-4 rounded-full bg-[#004322] flex items-center justify-center shrink-0 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">Picked up</p>
                <p className="text-[11px] text-[#707970]">Today, 10:45 AM</p>
              </div>
            </div>

            {/* Step 3: In Transit (Active) */}
            <div className="flex items-start gap-3 relative pb-6">
              <div className="absolute left-[7px] top-3 bottom-0 w-[2px] bg-[#e2e8f0]" />
              <div className="w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex items-center justify-center shrink-0 z-10 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">In Transit</p>
                <p className="text-[11px] text-[#707970] font-medium">Driver is 4km away</p>
              </div>
            </div>

            {/* Step 4: Arriving */}
            <div className="flex items-start gap-3 relative">
              <div className="w-4 h-4 rounded-full bg-[#c0c9be] flex items-center justify-center shrink-0 z-10" />
              <div>
                <p className="text-xs font-semibold text-[#707970]">Arriving</p>
                <p className="text-[11px] text-[#707970]">Estimated 11:35 AM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <a
            href={`tel:${driverPhone}`}
            data-testid="contact-driver-btn"
            className="w-full bg-[#004322] hover:bg-[#1a5c35] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <Icon name="chat" className="text-[19px]" />
            <span>Contact Driver</span>
          </a>

          <button
            type="button"
            onClick={() => addToast('Signalement transmis au support logistique.', 'info')}
            data-testid="report-issue-btn"
            className="w-full bg-white hover:bg-rose-50/60 border border-rose-300 text-rose-700 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-xs transition-all active:scale-[0.99] cursor-pointer"
          >
            <Icon name="error_outline" className="text-[19px] text-rose-600" />
            <span>Report Issue</span>
          </button>
        </div>
      </div>

      {/* ── 4. FIXED BOTTOM NAVIGATION ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e2e8f0] h-16 max-w-[480px] mx-auto px-2 flex items-center justify-around shadow-lg">
        <Link
          to="/marketplace"
          className="flex flex-col items-center gap-0.5 text-[#707970] hover:text-[#004322] transition-colors py-1 px-3"
        >
          <Icon name="home" className="text-[22px]" />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>
        <Link
          to="/marketplace"
          className="flex flex-col items-center gap-0.5 text-[#707970] hover:text-[#004322] transition-colors py-1 px-3"
        >
          <Icon name="spa" className="text-[22px]" />
          <span className="text-[10px] font-semibold">Products</span>
        </Link>
        <Link
          to="/auctions"
          className="flex flex-col items-center gap-0.5 text-[#707970] hover:text-[#004322] transition-colors py-1 px-3"
        >
          <Icon name="gavel" className="text-[22px]" />
          <span className="text-[10px] font-semibold">Auctions</span>
        </Link>
        <Link
          to="/orders"
          className="flex flex-col items-center gap-0.5 text-[#004322] font-bold py-1 px-3"
        >
          <Icon name="local_shipping" className="text-[22px]" />
          <span className="text-[10px] font-bold">Orders</span>
        </Link>
        <Link
          to="/profile"
          className="flex flex-col items-center gap-0.5 text-[#707970] hover:text-[#004322] transition-colors py-1 px-3"
        >
          <Icon name="person" className="text-[22px]" />
          <span className="text-[10px] font-semibold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
