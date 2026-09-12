import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

export interface LocationPickerMapProps {
  latitude?: number | '';
  longitude?: number | '';
  onChange: (coords: { lat: number; lon: number }) => void;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  label?: string;
}

function createPinIcon() {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute -top-7 flex flex-col items-center">
          <div class="w-8 h-8 rounded-full bg-[#1a5c35] text-white flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-[#1a5c35]/30">
            <span class="material-symbols-outlined text-lg">storefront</span>
          </div>
          <div class="w-2 h-2 bg-[#1a5c35] rotate-45 -mt-1 shadow-sm"></div>
        </div>
      </div>
    `,
    className: 'location-picker-pin',
    iconSize: [32, 32],
    iconAnchor: [16, 28],
  });
}

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, Math.max(map.getZoom(), 13), { animate: true });
    }
  }, [center, map]);
  return null;
}

export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  className = 'h-80 w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm relative z-0',
  defaultCenter = [-11.6609, 27.4794], // Default Katanga / Kipushi region or Abidjan/Dakar
  defaultZoom = 11,
  label = 'Emplacement sur la carte',
}: LocationPickerMapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [panTarget, setPanTarget] = useState<[number, number] | null>(null);

  const hasCoords =
    latitude !== '' &&
    longitude !== '' &&
    latitude != null &&
    longitude != null &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  const currentLat = hasCoords ? Number(latitude) : null;
  const currentLon = hasCoords ? Number(longitude) : null;

  const pinIcon = useMemo(() => createPinIcon(), []);
  const markerRef = useRef<L.Marker>(null);

  const initialCenter: [number, number] = hasCoords
    ? [Number(latitude), Number(longitude)]
    : defaultCenter;

  const handleMapClick = (lat: number, lon: number) => {
    onChange({
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
    });
  };

  const handleMarkerDragEnd = () => {
    const marker = markerRef.current;
    if (marker != null) {
      const latlng = marker.getLatLng();
      onChange({
        lat: Number(latlng.lat.toFixed(6)),
        lon: Number(latlng.lng.toFixed(6)),
      });
    }
  };

  const handleSearchLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=1`,
        {
          headers: {
            'Accept-Language': 'fr,en',
          },
        }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]) {
        const foundLat = parseFloat(data[0].lat);
        const foundLon = parseFloat(data[0].lon);
        onChange({
          lat: Number(foundLat.toFixed(6)),
          lon: Number(foundLon.toFixed(6)),
        });
        setPanTarget([foundLat, foundLon]);
      } else {
        setSearchError('Lieu introuvable. Essayez avec un autre nom de ville ou région.');
      }
    } catch {
      setSearchError('Impossible de rechercher le lieu pour le moment.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseCurrentPosition = () => {
    if (!navigator.geolocation) {
      setSearchError('La géolocalisation n’est pas supportée par votre navigateur.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        onChange({
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
        });
        setPanTarget([lat, lon]);
        setSearchError(null);
      },
      () => {
        setSearchError('Impossible de récupérer votre position actuelle.');
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-bold text-gray-700">
          {label}
        </label>
        {hasCoords && (
          <span className="text-[11px] font-mono text-[#1a5c35] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
            GPS : {currentLat?.toFixed(5)}°, {currentLon?.toFixed(5)}°
          </span>
        )}
      </div>

      {/* Search Bar & Geolocation Control */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-gray-400 material-symbols-outlined text-sm">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSearchLocation();
              }
            }}
            placeholder="Rechercher une ville, région ou adresse (ex: Kipushi, Dakar...)"
            className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a5c35] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSearchLocation()}
          disabled={isSearching || !searchQuery.trim()}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1"
        >
          {isSearching ? (
            <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
          ) : (
            'Chercher'
          )}
        </button>
        <button
          type="button"
          onClick={handleUseCurrentPosition}
          title="Utiliser ma position actuelle"
          className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">my_location</span>
          <span className="hidden sm:inline text-xs">Ma position</span>
        </button>
      </div>

      {searchError && (
        <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
          {searchError}
        </p>
      )}

      {/* Interactive Map Container */}
      <div className={className}>
        <MapContainer
          center={initialCenter}
          zoom={defaultZoom}
          scrollWheelZoom={true}
          className="h-full w-full z-0"
          style={{ minHeight: '100%', minWidth: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onSelect={handleMapClick} />
          <MapCenterController center={panTarget} />

          {hasCoords && currentLat != null && currentLon != null && (
            <Marker
              ref={markerRef}
              position={[currentLat, currentLon]}
              icon={pinIcon}
              draggable={true}
              eventHandlers={{
                dragend: handleMarkerDragEnd,
              }}
            />
          )}
        </MapContainer>

        {/* Map Overlay Instruction Badge */}
        <div className="absolute bottom-2 left-2 right-2 sm:right-auto z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg shadow-md border border-gray-200 text-[11px] text-gray-700 flex items-center gap-1.5 pointer-events-none">
          <span className="material-symbols-outlined text-sm text-[#1a5c35]">touch_app</span>
          <span>
            {hasCoords
              ? 'Marqueur positionné. Déplacez-le ou cliquez ailleurs pour ajuster.'
              : 'Cliquez sur la carte pour définir l’emplacement exact.'}
          </span>
        </div>
      </div>
    </div>
  );
}
