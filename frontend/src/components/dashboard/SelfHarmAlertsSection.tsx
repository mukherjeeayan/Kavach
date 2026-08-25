import { useSelfHarmAlerts, useAcknowledgeSelfHarmAlert } from '../../hooks/useSelfHarmAlerts';
import { SkeletonList } from '../ui/Skeleton';
import type { SelfHarmAlert } from '../../types/api';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

const riskBadge: Record<string, string> = {
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const sourceLabel: Record<string, string> = {
  SMS: 'SMS',
  APP_TEXT: 'App Text',
  KEYBOARD: 'Keyboard',
  SEARCH: 'Search',
};

export default function SelfHarmAlertsSection({ childId, onError }: Props) {
  const { data: alerts, isLoading } = useSelfHarmAlerts(childId, false);
  const acknowledge = useAcknowledgeSelfHarmAlert(childId);

  const unacknowledged = (alerts ?? []).filter((a) => !a.is_acknowledged);
  const acknowledged = (alerts ?? []).filter((a) => a.is_acknowledged);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledge.mutateAsync(alertId);
    } catch {
      onError('Failed to acknowledge alert');
    }
  };

  if (isLoading) return <SkeletonList items={3} />;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center relative">
            <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {unacknowledged.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unacknowledged.length}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Self-Harm Alerts</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unacknowledged.length} unacknowledged
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {(alerts ?? []).length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No self-harm alerts detected.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {unacknowledged.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
                  Needs Attention
                </h4>
                {unacknowledged.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} onAcknowledge={handleAcknowledge} isPending={acknowledge.isPending} />
                ))}
              </div>
            )}

            {acknowledged.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Acknowledged
                </h4>
                {acknowledged.slice(0, 5).map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
  isPending,
}: {
  alert: SelfHarmAlert;
  onAcknowledge?: (id: string) => void;
  isPending?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 mb-3 ${
        alert.is_acknowledged
          ? 'bg-gray-50 dark:bg-gray-700/30'
          : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${riskBadge[alert.risk_level]}`}>
              {alert.risk_level}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {sourceLabel[alert.source_type]}
            </span>
            {alert.is_acknowledged && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Acknowledged
              </span>
            )}
          </div>
          {alert.content_snippet && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">"{alert.content_snippet}"</p>
          )}
          {alert.detected_keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {alert.detected_keywords.map((kw) => (
                <span key={kw} className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded">
                  {kw}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>
        {!alert.is_acknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors ml-3"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
