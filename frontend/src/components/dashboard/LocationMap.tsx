import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LocationPoint } from '../../types/api';

// Fix Leaflet default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom blue marker for child locations
const childMarkerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to fit map bounds to all points
function FitBounds({ points }: { points: LocationPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const bounds = L.latLngBounds(
      points.map((p) => [p.latitude, p.longitude] as [number, number])
    );

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    }
  }, [map, points]);

  return null;
}

/**
 * Embedded OpenStreetMap map of the child's recent locations.
 * Uses react-leaflet + OpenStreetMap tiles (100% free, no API key required).
 * Renders nothing when there are no points to display.
 */
export default function LocationMap({ points }: { points: LocationPoint[] }) {
  // Calculate center point from all locations
  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return [20.5937, 78.9629]; // Default: India
    if (points.length === 1) return [points[0].latitude, points[0].longitude];

    const sumLat = points.reduce((sum, p) => sum + p.latitude, 0);
    const sumLng = points.reduce((sum, p) => sum + p.longitude, 0);
    return [sumLat / points.length, sumLng / points.length];
  }, [points]);

  if (points.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
      <div className="p-4 pb-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">On the map</p>
      </div>
      <div className="h-64 w-full">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} />
          {points.map((point, index) => (
            <Marker
              key={index}
              position={[point.latitude, point.longitude]}
              icon={childMarkerIcon}
            >
              <Popup>
                <div>
                  <strong>{new Date(point.recorded_at).toLocaleString()}</strong>
                  <br />
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                  {point.accuracy_m != null && (
                    <span> ±{Math.round(point.accuracy_m)} m</span>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
