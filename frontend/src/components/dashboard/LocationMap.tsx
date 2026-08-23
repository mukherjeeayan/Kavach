import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LocationPoint } from '../../types/api';
import apiClient from '../../services/apiClient';

/**
 * Embedded Mapbox map of the child's recent locations. The token is
 * fetched at runtime from the backend (/geo/mapbox-token) so it is
 * never baked into the JS bundle. Renders nothing when the backend has
 * no map integration configured — callers fall back to link cards.
 */
export default function LocationMap({ points }: { points: LocationPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const prevPointsRef = useRef<LocationPoint[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/geo/mapbox-token')
      .then((res: any) => {
        if (active) setToken(res?.data?.data?.token ?? null);
      })
      .catch(() => {
        // Map integration not configured — fall back to link cards.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token || !containerRef.current || points.length === 0) return;

    // Skip update if points haven't changed (reference or content)
    if (
      prevPointsRef.current.length === points.length &&
      prevPointsRef.current.every(
        (p, i) =>
          p.latitude === points[i].latitude &&
          p.longitude === points[i].longitude &&
          p.recorded_at === points[i].recorded_at
      )
    ) {
      return;
    }
    prevPointsRef.current = points;

    mapboxgl.accessToken = token;
    
    // Only create map if it doesn't exist
    if (!mapRef.current) {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [points[0].longitude, points[0].latitude],
        zoom: 10,
      });
      mapRef.current = map;
    }

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    points.forEach((point) => {
      const time = document.createTextNode(new Date(point.recorded_at).toLocaleString());
      const strong = document.createElement('strong');
      strong.appendChild(time);
      const popupEl = document.createElement('div');
      popupEl.appendChild(strong);
      popupEl.appendChild(document.createElement('br'));
      popupEl.appendChild(
        document.createTextNode(
          `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` +
            (point.accuracy_m != null ? ` ±${Math.round(point.accuracy_m)} m` : '')
        )
      );
      const marker = new mapboxgl.Marker({ color: '#2563eb' })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setDOMContent(popupEl))
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13 });
    }
  }, [token, points]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (!token || points.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
      <div className="p-4 pb-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">On the map</p>
      </div>
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  );
}
