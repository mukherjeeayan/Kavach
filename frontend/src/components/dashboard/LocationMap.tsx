import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LocationPoint } from '../../types/api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * Embedded Mapbox map of the child's recent locations. Renders nothing
 * when VITE_MAPBOX_TOKEN is unset — callers fall back to link cards.
 */
export default function LocationMap({ points }: { points: LocationPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || points.length === 0) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [points[0].longitude, points[0].latitude],
      zoom: 10,
    });
    mapRef.current = map;

    points.forEach((point) => {
      new mapboxgl.Marker({ color: '#2563eb' })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(
            `<strong>${new Date(point.recorded_at).toLocaleString()}</strong><br/>` +
              `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` +
              (point.accuracy_m != null
                ? `<br/>±${Math.round(point.accuracy_m)} m`
                : '')
          )
        )
        .addTo(map);
    });

    if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  if (!MAPBOX_TOKEN || points.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border mb-4 overflow-hidden">
      <div className="p-4 pb-2">
        <p className="text-sm text-gray-500">On the map</p>
      </div>
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  );
}