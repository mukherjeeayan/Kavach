import { useBehaviorPredictions } from '../../hooks/usePredictions';
import { SkeletonList } from '../ui/Skeleton';

interface Props {
  childId: string;
}

const PREDICTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  HIGH_RISK_TIME: {
    bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  SCREEN_TIME_TREND: {
    bg: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  APP_USAGE_PATTERN: {
    bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  SOCIAL_RISK: {
    bg: 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-400',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
};

const PREDICTION_LABELS: Record<string, string> = {
  HIGH_RISK_TIME: 'High Risk Time',
  SCREEN_TIME_TREND: 'Screen Time Trend',
  APP_USAGE_PATTERN: 'App Usage Pattern',
  SOCIAL_RISK: 'Social Risk',
};

function getRiskColor(score: number): string {
  if (score >= 70) return 'text-red-600 dark:text-red-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-green-600 dark:text-green-400';
}

function getRiskBg(score: number): string {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-green-500';
}

export default function BehaviorPredictionSection({ childId }: Props) {
  const { data: predictions, isLoading } = useBehaviorPredictions(childId);

  if (isLoading) return <SkeletonList items={3} />;

  const activePredictions = (predictions ?? []).filter((p) => p.is_active);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Insights</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {activePredictions.length} active prediction{activePredictions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {activePredictions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No predictions available yet. AI insights will appear as more data is collected.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activePredictions.map((pred) => {
              const style = PREDICTION_STYLES[pred.prediction_type] ?? PREDICTION_STYLES.SOCIAL_RISK;
              return (
                <div
                  key={pred.id}
                  className={`rounded-lg border p-4 ${style.bg}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <svg className={`w-5 h-5 mt-0.5 ${style.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon} />
                      </svg>
                      <div>
                        <p className={`text-sm font-semibold ${style.text}`}>
                          {PREDICTION_LABELS[pred.prediction_type] ?? pred.prediction_type}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Confidence: {Math.round(pred.confidence * 100)}%
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          Valid: {new Date(pred.valid_from).toLocaleDateString()} - {new Date(pred.valid_until).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${getRiskColor(pred.risk_score)}`}>
                        {pred.risk_score}
                      </span>
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full ${getRiskBg(pred.risk_score)}`}
                          style={{ width: `${pred.risk_score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
