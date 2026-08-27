import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

export interface MapStop {
  id: string;
  lat: number;
  lon: number;
  label: string;
  type?: 'COLLECTION' | 'DELIVERY' | 'STOP';
  status?: string;
}

export interface DeliveryMapProps {
  driverPosition?: { lat: number; lon: number; heading?: number | undefined } | null | undefined;
  driverName?: string | undefined;
  stops?: MapStop[] | undefined;
  routePolyline?: [number, number][] | undefined;
  className?: string | undefined;
  defaultCenter?: [number, number] | undefined;
  defaultZoom?: number | undefined;
}

function createIcon(html: string, className = '', iconSize: [number, number] = [36, 36]) {
  return L.divIcon({
    html,
    className: `custom-div-icon ${className}`,
    iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
    popupAnchor: [0, -iconSize[1] / 2],
  });
}

function MapAutoBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 1 && points[0]) {
      map.setView(points[0], 14, { animate: true });
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points.map(([lat, lon]) => [lat, lon]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
    }
  }, [map, points]);

  return null;
}

export function DeliveryMap({
  driverPosition,
  driverName = 'Livreur',
  stops = [],
  routePolyline,
  className = 'h-72 w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0',
  defaultCenter = [5.359951, -3.981409], // Default Abidjan coordinates
  defaultZoom = 12,
}: DeliveryMapProps) {
  const allPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (driverPosition && !isNaN(driverPosition.lat) && !isNaN(driverPosition.lon)) {
      pts.push([driverPosition.lat, driverPosition.lon]);
    }
    stops.forEach((s) => {
      if (!isNaN(s.lat) && !isNaN(s.lon)) {
        pts.push([s.lat, s.lon]);
      }
    });
    return pts;
  }, [driverPosition, stops]);

  const center: [number, number] = allPoints.length > 0 && allPoints[0] ? allPoints[0] : defaultCenter;

  const driverIcon = useMemo(() => {
    const heading = driverPosition?.heading ?? 0;
    return createIcon(
      `<div class="relative flex items-center justify-center w-9 h-9 bg-[#004322] text-white rounded-full shadow-lg border-2 border-white ring-2 ring-[#004322]/30 animate-pulse">
        <span class="material-symbols-outlined text-lg" style="transform: rotate(${heading}deg);">local_shipping</span>
      </div>`,
      'driver-marker',
      [36, 36]
    );
  }, [driverPosition?.heading]);

  const getStopIcon = (stop: MapStop, index: number) => {
    const isCollection = stop.type === 'COLLECTION';
    const isCompleted = stop.status === 'COMPLETED';
    const bgColor = isCompleted ? 'bg-emerald-600' : isCollection ? 'bg-amber-500' : 'bg-[#1a5c35]';
    const iconName = isCompleted ? 'check' : isCollection ? 'storefront' : 'home_pin';

    return createIcon(
      `<div class="flex flex-col items-center">
        <div class="flex items-center justify-center w-7 h-7 ${bgColor} text-white rounded-full shadow-md border-2 border-white text-xs font-bold">
          <span class="material-symbols-outlined text-sm">${iconName}</span>
        </div>
        <span class="text-[9px] font-bold bg-white/95 text-gray-800 px-1 py-0.5 rounded shadow-sm mt-0.5 border border-gray-100 whitespace-nowrap">
          #${index + 1} ${stop.label}
        </span>
      </div>`,
      'stop-marker',
      [60, 48]
    );
  };

  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={defaultZoom}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
        style={{ minHeight: '100%', minWidth: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {allPoints.length > 0 && <MapAutoBounds points={allPoints} />}

        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            color="#1a5c35"
            weight={4}
            opacity={0.7}
            dashArray="6, 8"
          />
        )}

        {driverPosition && !isNaN(driverPosition.lat) && !isNaN(driverPosition.lon) && (
          <Marker position={[driverPosition.lat, driverPosition.lon]} icon={driverIcon}>
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold text-[#004322]">{driverName}</p>
                <p className="text-gray-500">Position en direct</p>
                <p className="font-mono text-[10px] text-gray-400">
                  {driverPosition.lat.toFixed(4)}, {driverPosition.lon.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {stops.map((stop, idx) => (
          <Marker
            key={stop.id || idx}
            position={[stop.lat, stop.lon]}
            icon={getStopIcon(stop, idx)}
          >
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold">{stop.label}</p>
                <p className="text-gray-500 capitalize">{stop.type?.toLowerCase() || 'Arrêt'}</p>
                {stop.status && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold">
                    {stop.status}
                  </span>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
