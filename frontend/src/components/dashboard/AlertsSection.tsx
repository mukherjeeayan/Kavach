import { useChildAlerts } from '../../hooks/usePhase1Data';

/**
 * Recent tamper and screen-time-limit alerts for the selected child.
 * Data comes from the child's append-only audit log.
 */
export default function AlertsSection({ childId }: { childId: string | null }) {
  const alerts = useChildAlerts(childId);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Alerts</h2>
      <div className="bg-white rounded-lg border">
        {alerts.isLoading && (
          <p className="px-4 py-6 text-sm text-gray-500">Loading alerts...</p>
        )}
        {alerts.isError && (
          <p className="px-4 py-6 text-sm text-red-500" role="alert">
            Failed to load alerts.
          </p>
        )}
        {!alerts.isLoading && !alerts.isError && alerts.data && alerts.data.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400">
            No alerts yet — tampering or screen-time breaches will appear here.
          </p>
        )}
        {!alerts.isLoading && !alerts.isError && (alerts.data ?? []).length > 0 && (
          <ul className="divide-y">
            {(alerts.data ?? []).map((alert, i) => (
              <li key={`${alert.created_at}-${i}`} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={`mt-1 inline-block w-2 h-2 rounded-full ${
                    alert.action === 'TAMPER_ALERT' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                <div>
                  <p className="text-sm font-medium">
                    {alert.action === 'TAMPER_ALERT'
                      ? 'Device tamper detected'
                      : 'Screen-time limit reached'}
                  </p>
                  <p className="text-xs text-gray-500">{formatAlert(alert)}</p>
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
  return time;
}