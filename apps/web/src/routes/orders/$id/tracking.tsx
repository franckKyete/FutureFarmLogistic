import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getOrderDetailsQuery } from '@/features/orders/api/buyer-orders.queries';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/orders/$id/tracking')({
  beforeLoad: () => {
    requireAuth();
  },
  component: OrderTrackingPage,
});

const SIMULATED_LOCATION = {
  lat: 5.359951,
  lon: -3.981409,
  heading: 45,
  speedKmh: 32,
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function OrderTrackingPage() {
  const { id } = Route.useParams();
  const { data: order, isLoading, isError } = useQuery(getOrderDetailsQuery(id));

  const [timestamp, setTimestamp] = useState(new Date());
  const isConnected = true;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
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

  const location = SIMULATED_LOCATION;

  return (
    <div className="px-4 space-y-4 pb-8">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-bold text-emerald-700">
              Mise à jour en direct
            </span>
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-semibold">
          {formatDate(timestamp.toISOString())}
        </span>
      </div>

      <div className="relative bg-gray-200 rounded-xl h-64 w-full overflow-hidden border border-[#E5E7EB] shadow-inner">
        <div className="absolute inset-0 opacity-10">
          <div className="grid grid-cols-6 grid-rows-6 h-full w-full">
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} className="border border-gray-600/30" />
            ))}
          </div>
        </div>

        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-orange-300/40 -translate-x-1/2" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-orange-300/40 -translate-y-1/2" />

        <div className="absolute bottom-6 right-6 flex flex-col items-center">
          <span className="material-symbols-outlined text-2xl text-[#1a5c35]">location_on</span>
          <span className="text-[9px] font-bold text-[#1a5c35] bg-white/90 px-1.5 py-0.5 rounded shadow-sm mt-0.5">
            Destination
          </span>
        </div>

        <div
          className="absolute flex flex-col items-center transition-all duration-1000"
          style={{ top: '35%', left: '55%' }}
        >
          <span className="material-symbols-outlined text-3xl text-[#004322] drop-shadow-lg">
            directions_car
          </span>
          <span className="text-[9px] font-bold text-white bg-[#004322]/90 px-1.5 py-0.5 rounded shadow-sm mt-0.5">
            Livreur
          </span>
        </div>

        <div className="absolute top-6 left-6 flex flex-col items-center opacity-60">
          <span className="material-symbols-outlined text-xl text-gray-600">store</span>
          <span className="text-[9px] font-bold text-gray-600 bg-white/90 px-1.5 py-0.5 rounded shadow-sm mt-0.5">
            Départ
          </span>
        </div>

        <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm">
          <span
            className="material-symbols-outlined text-base text-[#0b1c30] block"
            style={{ transform: `rotate(${location.heading}deg)` }}
          >
            near_me
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Position du livreur
          </h2>
          <span className={`flex items-center gap-1 text-[10px] font-bold ${isConnected ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Latitude</p>
            <p className="text-sm font-bold text-[#0b1c30] font-mono">{location.lat.toFixed(4)}°</p>
          </div>
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Longitude</p>
            <p className="text-sm font-bold text-[#0b1c30] font-mono">{location.lon.toFixed(4)}°</p>
          </div>
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Vitesse</p>
            <p className="text-sm font-bold text-[#0b1c30]">
              {location.speedKmh} <span className="text-[10px] font-normal text-gray-500">km/h</span>
            </p>
          </div>
          <div className="bg-[#f8f9ff] rounded-lg p-3">
            <p className="text-[10px] text-gray-500 font-semibold">Cap</p>
            <p className="text-sm font-bold text-[#0b1c30]">
              {location.heading}° <span className="text-[10px] font-normal text-gray-500">NNE</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E5E7EB]">
          <p className="text-[10px] text-gray-500 font-semibold">Dernière mise à jour</p>
          <p className="text-xs font-bold text-[#0b1c30]">
            {timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm space-y-2">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Commande concernée</h2>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-bold text-[#0b1c30]">#{order.id.slice(0, 8)}</p>
            <p className="text-xs text-gray-500">
              {order.lines.length} article{order.lines.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link to="/orders/$id" params={{ id }} className="text-xs text-[#1a5c35] font-bold underline">
            Voir le détail
          </Link>
        </div>
      </div>

      <div className="bg-[#eff4ff] rounded-xl border border-blue-100 p-3">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-sm text-blue-600 mt-0.5">info</span>
          <p className="text-[10px] text-blue-800 leading-relaxed">
            Le suivi en direct sera actif une fois que le livreur aura démarré la tournée.
            Les données de localisation sont mises à jour toutes les 30 secondes.
          </p>
        </div>
      </div>
    </div>
  );
}
