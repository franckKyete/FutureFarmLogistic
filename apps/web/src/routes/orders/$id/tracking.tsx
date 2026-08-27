import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetailsQuery } from '@/features/orders/api/buyer-orders.queries';
import { useDeliveryRuns } from '@/features/admin/api/logistics.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useDeliveryMap } from '@/features/shared/hooks/useDeliveryMap';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { useMemo } from 'react';

export const Route = createFileRoute('/orders/$id/tracking')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrderTrackingPage,
});

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function OrderTrackingPage() {
  const { id } = Route.useParams();
  const { data: order, isLoading: orderLoading, isError } = useQuery(getOrderDetailsQuery(id));
  const { data: runs = [] } = useDeliveryRuns();

  // Find delivery run that contains stops for any line of this order
  const matchedRun = useMemo(() => {
    if (!order || !order.lines || runs.length === 0) return null;
    const orderLineIds = new Set(order.lines.map((l) => l.id));
    return runs.find((r) => r.stops?.some((s) => orderLineIds.has(s.orderLineId))) || null;
  }, [order, runs]);

  const { location, isConnected } = useDeliveryMap(matchedRun?.id);

  const stops: MapStop[] = useMemo(() => {
    if (!matchedRun?.stops) {
      // Fallback destination pin if order address is known
      return [
        {
          id: 'dest',
          lat: 5.359951,
          lon: -3.981409,
          label: order?.deliveryAddress?.city || 'Destination',
          type: 'DELIVERY',
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
  }, [matchedRun, order]);

  if (orderLoading) {
    return (
      <div className="px-4 space-y-4 animate-pulse">
        <div className="bg-gray-200 rounded-xl h-64 w-full" />
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 space-y-3">
          <div className="h-3 w-32 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="px-4 py-16 text-center">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-3 block">
          error_outline
        </span>
        <p className="text-sm text-gray-500 font-semibold">
          Impossible de charger les informations de suivi
        </p>
        <Link to="/orders/$id" params={{ id }} className="text-xs text-[#1a5c35] font-bold underline mt-2 inline-block">
          Retour à la commande
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4 pb-8">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className={`text-xs font-bold ${isConnected ? 'text-emerald-700' : 'text-gray-500'}`}>
              {isConnected ? 'Mise à jour en direct' : 'En attente de connexion'}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-semibold">
          {formatDate(location?.recordedAt || new Date().toISOString())}
        </span>
      </div>

      {/* Real Interactive Leaflet Map */}
      <DeliveryMap
        driverPosition={location ? { lat: location.lat, lon: location.lon, heading: location.heading } : null}
        driverName={matchedRun?.driver ? `${matchedRun.driver.firstName} ${matchedRun.driver.lastName}` : 'Livreur'}
        stops={stops}
        className="h-72 w-full rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm relative z-0"
      />

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Position du livreur
          </h2>
          <span className={`flex items-center gap-1 text-[10px] font-bold ${isConnected ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {isConnected ? 'Connecté (Temps réel)' : 'Dernière position connue'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Latitude</p>
            <p className="text-sm font-bold text-[#0b1c30] font-mono">
              {location ? `${location.lat.toFixed(4)}°` : '—'}
            </p>
          </div>
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Longitude</p>
            <p className="text-sm font-bold text-[#0b1c30] font-mono">
              {location ? `${location.lon.toFixed(4)}°` : '—'}
            </p>
          </div>
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Vitesse</p>
            <p className="text-sm font-bold text-[#0b1c30]">
              {location?.speedKmh ?? 0} <span className="text-[10px] font-normal text-gray-500">km/h</span>
            </p>
          </div>
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Cap</p>
            <p className="text-sm font-bold text-[#0b1c30]">
              {location?.heading ?? 0}° <span className="text-[10px] font-normal text-gray-500">Direction</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
          <p className="text-[10px] text-gray-500 font-semibold">Dernière mise à jour</p>
          <p className="text-xs font-bold text-[#0b1c30]">
            {location?.recordedAt
              ? new Date(location.recordedAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'En attente de signal'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-2">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commande concernée</h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-[#0b1c30]">#{order.id.slice(0, 8)}</p>
            <p className="text-xs text-gray-500">
              {order.lines.length} article{order.lines.length !== 1 ? 's' : ''} • Statut : {order.status}
            </p>
          </div>
          <Link to="/orders/$id" params={{ id }} className="text-xs text-[#1a5c35] font-bold underline">
            Voir le détail
          </Link>
        </div>
      </div>

      {matchedRun && (
        <div className="bg-[#eff4ff] rounded-xl border border-blue-100 p-3">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-sm text-blue-600 mt-0.5">local_shipping</span>
            <p className="text-[10px] text-blue-800 leading-relaxed">
              Tournée #{matchedRun.id.slice(0, 8)} en cours avec {matchedRun.stops?.length || 0} arrêts prévus.
              Chauffeur : {matchedRun.driver ? `${matchedRun.driver.firstName} ${matchedRun.driver.lastName}` : 'Assigné'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

