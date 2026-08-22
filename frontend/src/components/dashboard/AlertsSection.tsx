import { useChildAlerts } from '../../hooks/usePhase1Data';
import { SkeletonList } from '../ui/Skeleton';

export default function AlertsSection({ childId }: { childId: string | null }) {
  const alerts = useChildAlerts(childId);

  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Alerts</h2>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {alerts.isLoading && (
          <div className="p-4">
            <SkeletonList items={2} />
          </div>
        )}
        {alerts.isError && (
          <div className="px-4 py-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              Failed to load alerts. Please try refreshing the page.
            </p>
          </div>
        )}
        {!alerts.isLoading && !alerts.isError && alerts.data && alerts.data.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No alerts yet - tampering or screen-time breaches will appear here.
            </p>
          </div>
        )}
        {!alerts.isLoading && !alerts.isError && (alerts.data ?? []).length > 0 && (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(alerts.data ?? []).map((alert, i) => (
              <li key={`${alert.created_at}-${i}`} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={`mt-1 inline-block w-2 h-2 rounded-full shrink-0 ${
                    alert.action === 'TAMPER_ALERT' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {alert.action === 'TAMPER_ALERT'
                      ? 'Device tamper detected'
                      : alert.action === 'PER_APP_LIMIT_REACHED'
                        ? 'Per-app daily limit reached'
                        : 'Screen-time limit reached'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatAlert(alert)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatAlert(alert: {
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}): string {
  const time = new Date(alert.created_at).toLocaleString();
  if (alert.action === 'SCREEN_TIME_LIMIT_REACHED') {
    const minutes = alert.details?.limit_minutes;
    return `Exceeded the daily limit${minutes ? ` (${minutes} min)` : ''} — ${time}`;
  }
  if (alert.action === 'PER_APP_LIMIT_REACHED') {
    const app = alert.details?.app_name ?? alert.details?.package_name;
    const minutes = alert.details?.limit_minutes;
    return `${app ?? 'An app'} exceeded its ${minutes ? `${minutes}-min ` : ''}daily limit — ${time}`;
  }
  return time;
}