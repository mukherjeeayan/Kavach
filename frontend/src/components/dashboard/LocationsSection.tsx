import { useCurrentLocations, useLocationHistory } from '../../hooks/usePhase1Data';
import LocationMap from './LocationMap';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface LocationsSectionProps {
  childId: string | null;
}

function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export default function LocationsSection({ childId }: LocationsSectionProps) {
  const current = useCurrentLocations(childId);
  const history = useLocationHistory(childId);

  const latest = current.data?.[0] ?? history.data?.[0];

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Location</h2>

      <LocationMap points={history.data ?? []} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {history.data?.map((point) => (
          <a
            key={point.id}
            href={mapsLink(point.latitude, point.longitude)}
            target="_blank"
            rel="noreferrer"
            className={`bg-white rounded-lg p-4 border hover:shadow-md transition-shadow ${
              latest?.id === point.id ? 'border-blue-500' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {latest?.id === point.id ? 'Latest position' : 'Recent position'}
              </p>
              <span className="text-xs text-gray-400">{formatTime(point.recorded_at)}</span>
            </div>
            <p className="font-mono text-sm text-gray-600 mt-1">
              {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {point.accuracy_m != null ? `±${Math.round(point.accuracy_m)} m` : 'accuracy n/a'}
              {point.speed_kmh != null ? ` · ${Math.round(point.speed_kmh)} km/h` : ''}
            </p>
            <p className="text-xs text-blue-600 mt-2">Open in Google Maps →</p>
          </a>
        ))}
      </div>

      {(history.data ?? []).length === 0 && (
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-gray-400">
            No location pings yet. The child's device shares a position every few minutes while it
            has the location permission.
          </p>
        </div>
      )}
    </section>
  );
}