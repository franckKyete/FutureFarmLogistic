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

export interface DriverMarkerInfo {
  driverId: string;
  driverName?: string | null | undefined;
  driverPhone?: string | null | undefined;
  vehiclePlate?: string | null | undefined;
  vehicleType?: string | null | undefined;
  lat: number;
  lon: number;
  heading?: number | null | undefined;
  speedKmh?: number | null | undefined;
  recordedAt?: string | Date | undefined;
}

export interface DeliveryMapProps {
  adminPosition?: [number, number] | null | undefined;
  driverPosition?: { lat: number; lon: number; heading?: number | undefined } | null | undefined;
  driverName?: string | undefined;
  drivers?: DriverMarkerInfo[] | undefined;
  stops?: MapStop[] | undefined;
  routePolyline?: [number, number][] | undefined;
  className?: string | undefined;
  defaultCenter?: [number, number] | undefined;
  defaultZoom?: number | undefined;
  focusOnStops?: boolean | undefined;
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

function MapCenterController({
  center,
  zoom,
}: {
  center: [number, number] | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom ?? 13, { animate: true });
    }
  }, [center, map, zoom]);
  return null;
}

export function DeliveryMap({
  adminPosition,
  driverPosition,
  driverName = 'Livreur',
  drivers = [],
  stops = [],
  routePolyline,
  className = 'h-72 w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0',
  defaultCenter = [5.359951, -3.981409], // Default Abidjan coordinates
  defaultZoom = 12,
  focusOnStops = false,
}: DeliveryMapProps) {
  const allPoints: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (!focusOnStops && adminPosition && !isNaN(adminPosition[0]) && !isNaN(adminPosition[1])) {
      pts.push([adminPosition[0], adminPosition[1]]);
    }
    if (driverPosition && !isNaN(driverPosition.lat) && !isNaN(driverPosition.lon)) {
      pts.push([driverPosition.lat, driverPosition.lon]);
    }
    if (!focusOnStops) {
      drivers.forEach((d) => {
        if (!isNaN(d.lat) && !isNaN(d.lon)) {
          pts.push([d.lat, d.lon]);
        }
      });
    }
    stops.forEach((s) => {
      if (!isNaN(s.lat) && !isNaN(s.lon)) {
        pts.push([s.lat, s.lon]);
      }
    });
    return pts;
  }, [adminPosition, driverPosition, drivers, stops, focusOnStops]);

  const center: [number, number] = useMemo(() => {
    if (focusOnStops && stops.length > 0 && !isNaN(stops[0]!.lat) && !isNaN(stops[0]!.lon)) {
      return [stops[0]!.lat, stops[0]!.lon];
    }
    if (adminPosition && !isNaN(adminPosition[0]) && !isNaN(adminPosition[1])) {
      return adminPosition;
    }
    if (driverPosition && !isNaN(driverPosition.lat) && !isNaN(driverPosition.lon)) {
      return [driverPosition.lat, driverPosition.lon];
    }
    if (drivers.length > 0 && !isNaN(drivers[0]!.lat) && !isNaN(drivers[0]!.lon)) {
      return [drivers[0]!.lat, drivers[0]!.lon];
    }
    if (stops.length > 0 && !isNaN(stops[0]!.lat) && !isNaN(stops[0]!.lon)) {
      return [stops[0]!.lat, stops[0]!.lon];
    }
    return defaultCenter;
  }, [adminPosition, driverPosition, drivers, stops, defaultCenter, focusOnStops]);

  const adminIcon = useMemo(() => {
    return createIcon(
      `<div class="relative flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-full shadow-lg border-2 border-white ring-4 ring-blue-400/40">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
      </div>`,
      'admin-marker',
      [36, 36]
    );
  }, []);

  const driverIcon = useMemo(() => {
    const heading = driverPosition?.heading ?? 0;
    return createIcon(
      `<div class="relative flex items-center justify-center w-9 h-9 bg-[#004322] text-white rounded-full shadow-lg border-2 border-white ring-2 ring-[#004322]/30 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading}deg);"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
      </div>`,
      'driver-marker',
      [36, 36]
    );
  }, [driverPosition?.heading]);

  const getStopIcon = (stop: MapStop, index: number) => {
    const isCollection = stop.type === 'COLLECTION';
    const isCompleted = stop.status === 'COMPLETED';
    const bgColor = isCompleted ? 'bg-emerald-600' : isCollection ? 'bg-amber-500' : 'bg-[#1a5c35]';
    const svgIcon = isCompleted
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : isCollection
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

    return createIcon(
      `<div class="flex flex-col items-center">
        <div class="flex items-center justify-center w-7 h-7 ${bgColor} text-white rounded-full shadow-md border-2 border-white text-xs font-bold">
          ${svgIcon}
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

        {focusOnStops ? (
          allPoints.length > 0 && <MapAutoBounds points={allPoints} />
        ) : adminPosition && !isNaN(adminPosition[0]) && !isNaN(adminPosition[1]) ? (
          <MapCenterController center={adminPosition} zoom={defaultZoom ?? 13} />
        ) : (
          allPoints.length > 0 && <MapAutoBounds points={allPoints} />
        )}

        {/* Admin Current Location Marker */}
        {adminPosition && !isNaN(adminPosition[0]) && !isNaN(adminPosition[1]) && (
          <Marker position={adminPosition} icon={adminIcon}>
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold text-blue-700">Votre position (Admin)</p>
                <p className="text-gray-500">Centre de contrôle logistique</p>
                <p className="font-mono text-[10px] text-gray-400">
                  {adminPosition[0].toFixed(4)}, {adminPosition[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            color="#1a5c35"
            weight={4}
            opacity={0.7}
            dashArray="6, 8"
          />
        )}

        {/* Single Driver Marker (e.g. focused active run) */}
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

        {/* Multiple Drivers Fleet Markers */}
        {drivers.map((drv) => {
          const heading = drv.heading ?? 0;
          const drvIcon = createIcon(
            `<div class="relative flex items-center justify-center w-9 h-9 bg-[#004322] text-white rounded-full shadow-lg border-2 border-white ring-2 ring-[#004322]/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading}deg);"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
            </div>`,
            'fleet-driver-marker',
            [36, 36]
          );
          return (
            <Marker key={drv.driverId} position={[drv.lat, drv.lon]} icon={drvIcon}>
              <Popup>
                <div className="text-xs p-1 space-y-0.5">
                  <p className="font-bold text-[#004322]">{drv.driverName || 'Chauffeur'}</p>
                  {drv.vehiclePlate && (
                    <p className="text-gray-700 font-medium">Véhicule : {drv.vehiclePlate} ({drv.vehicleType || 'standard'})</p>
                  )}
                  {drv.speedKmh != null && drv.speedKmh > 0 && (
                    <p className="text-emerald-700 font-semibold">{drv.speedKmh} km/h</p>
                  )}
                  <p className="font-mono text-[10px] text-gray-400">
                    {drv.lat.toFixed(4)}, {drv.lon.toFixed(4)}
                  </p>
                  {drv.recordedAt && (
                    <p className="text-[10px] text-gray-500">
                      Vu : {new Date(drv.recordedAt).toLocaleTimeString('fr-FR')}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

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
