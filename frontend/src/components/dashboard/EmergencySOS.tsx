import { useSosEvents, useAcknowledgeSos, useResolveSos } from '../../hooks/useSos';
import { SkeletonList } from '../ui/Skeleton';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

export default function EmergencySOS({ childId, onError }: Props) {
  const { data: events, isLoading } = useSosEvents(childId);
  const acknowledge = useAcknowledgeSos(childId);
  const resolve = useResolveSos(childId);

  const activeEvents = (events ?? []).filter((e) => e.status === 'ACTIVE');
  const otherEvents = (events ?? []).filter((e) => e.status !== 'ACTIVE');

  const handleAcknowledge = async (eventId: string) => {
    try {
      await acknowledge.mutateAsync(eventId);
    } catch {
      onError('Failed to acknowledge SOS event');
    }
  };

  const handleResolve = async (eventId: string) => {
    try {
      await resolve.mutateAsync({ eventId });
    } catch {
      onError('Failed to resolve SOS event');
    }
  };

  if (isLoading) return <SkeletonList items={2} />;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center relative">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {activeEvents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {activeEvents.length}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Emergency SOS</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activeEvents.length} active alert{activeEvents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {(events ?? []).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No SOS events recorded.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeEvents.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
                  Active Alerts
                </h4>
                {activeEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 mb-3 animate-pulse"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                            ACTIVE
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Triggered via {event.trigger_method}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                        {event.latitude && event.longitude && (
                          <a
                            href={`https://www.google.com/maps?q=${event.latitude},${event.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline mt-1 inline-block"
                          >
                            View on map ({event.latitude.toFixed(4)}, {event.longitude.toFixed(4)})
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcknowledge(event.id)}
                          disabled={acknowledge.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleResolve(event.id)}
                          disabled={resolve.isPending}
                          className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {otherEvents.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  History
                </h4>
                {otherEvents.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        event.status === 'ACKNOWLEDGED'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {event.status}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {event.trigger_method} - {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
