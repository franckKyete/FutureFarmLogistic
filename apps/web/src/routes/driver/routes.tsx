import { Icon } from '@/features/shared/components/Icon';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyRunsQuery } from '@/features/tracking/api/tracking.queries';
import { DeliveryMap, MapStop } from '@/features/shared/components/DeliveryMap';
import { useDeliveryMap } from '@/features/shared/hooks/useDeliveryMap';
import { DeliveryRunStatus, DeliveryStopStatus } from '@futurefarm/types';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const Route = createFileRoute('/driver/routes')({
  component: DriverRoutesFullMapPage,
});

function DriverRoutesFullMapPage() {
  const { user } = useAuth();

  const { data: runs = [] } = useQuery(getMyRunsQuery());

  // Find currently active run or earliest planned run
  const activeRun = runs.find((r) => r.status === DeliveryRunStatus.IN_PROGRESS) || runs[0];
  const { location, isConnected } = useDeliveryMap(activeRun?.id || '');

  const mapStops: MapStop[] = useMemo(() => {
    if (!activeRun?.stops) return [];
    return activeRun.stops.map((s, idx) => ({
      id: s.id,
      lat: s.address.lat,
      lon: s.address.lon,
      label: `${idx + 2} - ${s.type === 'COLLECTION' ? 'COLLECTE' : 'LIVRAISON'}`,
      type: s.type as 'COLLECTION' | 'DELIVERY',
      status: s.status,
    }));
  }, [activeRun?.stops]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Top Header */}
      <header className="bg-white px-4 py-3.5 border-b border-gray-100 z-30 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#004322]/10 flex items-center justify-center text-[#004322]">
            <Icon name="local_shipping" className="text-xl" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-[#004322]">
            Future Farm Logistic V2.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              GPS actif
            </span>
          )}

          <Link to="/driver/profile">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.firstName}
                className="w-8 h-8 rounded-full object-cover border-2 border-emerald-600 shadow-2xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#004322] text-white flex items-center justify-center font-bold text-xs">
                {user?.firstName?.charAt(0) || 'M'}
              </div>
            )}
          </Link>
        </div>
      </header>

      {/* Full Map Canvas */}
      <div className="flex-1 relative">
        <DeliveryMap
          stops={mapStops}
          driverPosition={
            location
              ? { lat: location.lat, lon: location.lon, heading: location.heading }
              : activeRun?.stops?.[0]
                ? {
                    lat: activeRun.stops[0].address.lat - 0.005,
                    lon: activeRun.stops[0].address.lon - 0.005,
                  }
                : null
          }
          className="w-full h-full"
        />

        {/* Floating Back / Detail Pill */}
        {activeRun && (
          <div className="absolute bottom-6 left-4 right-4 z-10">
            <div className="bg-white rounded-2xl p-4 shadow-xl border border-gray-100 flex items-center justify-between backdrop-blur-md">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                  Tournée active
                </p>
                <h4 className="font-mono font-bold text-sm text-[#0b1c30]">
                  #TRK-{activeRun.id.slice(0, 6).toUpperCase()}
                </h4>
                <p className="text-xs text-gray-500">
                  {activeRun.stops?.length || 0} arrêts •{' '}
                  {activeRun.stops?.filter((s) => s.status !== DeliveryStopStatus.COMPLETED).length || 0}{' '}
                  restants
                </p>
              </div>

              <Link
                to="/driver/runs/$id"
                params={{ id: activeRun.id }}
                className="px-5 py-2.5 bg-[#004322] hover:bg-[#00331a] text-white font-bold text-xs rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                <span>Voir la feuille de route</span>
                <Icon name="arrow_forward" className="text-sm" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
