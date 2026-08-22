import { useCurrentLocations, useLocationHistory } from '../../hooks/usePhase1Data';
import LocationMap from './LocationMap';
import { SkeletonCard } from '../ui/Skeleton';

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
  const isLoading = current.isLoading || history.isLoading;
  const isError = current.isError || history.isError;

  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Location</h2>

      {isLoading && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load location data.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <LocationMap points={history.data ?? []} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {history.data?.map((point) => (
              <a
                key={point.id}
                href={mapsLink(point.latitude, point.longitude)}
                target="_blank"
                rel="noreferrer"
                className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow ${
                  latest?.id === point.id ? 'border-blue-500 dark:border-blue-400' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {latest?.id === point.id ? 'Latest position' : 'Recent position'}
                  </p>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatTime(point.recorded_at)}</span>
                </div>
                <p className="font-mono text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {point.accuracy_m != null ? `±${Math.round(point.accuracy_m)} m` : 'accuracy n/a'}
                  {point.speed_kmh != null ? ` · ${Math.round(point.speed_kmh)} km/h` : ''}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Open in Google Maps →</p>
              </a>
            ))}
          </div>

          {(history.data ?? []).length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No location pings yet. The child's device shares a position every few minutes while it
                has the location permission.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}