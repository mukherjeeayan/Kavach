import { useKeywordAlerts, useReviewKeywordAlert } from '../../hooks/useCommunications';
import { SkeletonList } from '../ui/Skeleton';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  LOW: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function KeywordAlertsSection({ childId, onError }: Props) {
  const { data: alerts, isLoading } = useKeywordAlerts(childId);
  const reviewAlert = useReviewKeywordAlert(childId);

  const handleReview = async (alertId: string) => {
    try {
      await reviewAlert.mutateAsync(alertId);
    } catch {
      onError('Failed to mark alert as reviewed');
    }
  };

  if (isLoading) return <SkeletonList items={3} />;

  const unreviewed = (alerts ?? []).filter((a) => !a.is_reviewed);
  const reviewed = (alerts ?? []).filter((a) => a.is_reviewed);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Alerts</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {unreviewed.length} unreviewed alert{unreviewed.length !== 1 ? 's' : ''}
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
            <p className="text-sm text-gray-500 dark:text-gray-400">No keyword alerts detected. All clear!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unreviewed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Needs Review
                </h4>
                {unreviewed.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_STYLES[alert.severity]}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {alert.source_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {alert.detected_keywords.map((kw, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300">
                              {kw}
                            </span>
                          ))}
                        </div>
                        {alert.content_snippet && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                            "{alert.content_snippet}"
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleReview(alert.id)}
                        disabled={reviewAlert.isPending}
                        className="ml-4 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Mark Reviewed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reviewed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Reviewed
                </h4>
                {reviewed.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 mb-2 opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_STYLES[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {alert.detected_keywords.join(', ')}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(alert.created_at).toLocaleString()}
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
