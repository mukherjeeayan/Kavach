import { useState } from 'react';
import { useMoodLogs } from '../../hooks/useMood';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SkeletonCard } from '../ui/Skeleton';

interface Props {
  childId: string;
}

const MOOD_PAGE_SIZE = 20;

const MOOD_LABELS: Record<number, { emoji: string; label: string; color: string }> = {
  1: { emoji: '😞', label: 'Very Sad', color: '#EF4444' },
  2: { emoji: '😔', label: 'Sad', color: '#F97316' },
  3: { emoji: '😐', label: 'Neutral', color: '#EAB308' },
  4: { emoji: '🙂', label: 'Happy', color: '#22C55E' },
  5: { emoji: '😊', label: 'Very Happy', color: '#3B82F6' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MoodTrackingSection({ childId }: Props) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMoodLogs(childId, page, MOOD_PAGE_SIZE);

  if (isLoading) return <SkeletonCard />;

  const moodLogs = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.total_pages ?? 0;

  const avgMood = moodLogs.length
    ? (moodLogs.reduce((s, l) => s + l.mood_score, 0) / moodLogs.length).toFixed(1)
    : null;

  const chartData = moodLogs
    .slice(-14)
    .reverse()
    .map((l) => ({
      date: formatDate(l.recorded_at),
      mood: l.mood_score,
    }));

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mood Tracking</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {moodLogs.length} entries &middot; Avg: {avgMood ? `${avgMood}/5` : 'No data'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {moodLogs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No mood entries recorded yet. Your child can log their mood from the device app.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Average Mood Display */}
            <div className="flex items-center justify-center gap-6">
              {Object.entries(MOOD_LABELS).map(([score, info]) => {
                const count = moodLogs.filter((l) => l.mood_score === Number(score)).length;
                const pct = Math.round((count / moodLogs.length) * 100);
                return (
                  <div key={score} className="text-center">
                    <div className="text-2xl mb-1">{info.emoji}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{pct}%</div>
                  </div>
                );
              })}
            </div>

            {/* Mood Trend Chart */}
            {chartData.length > 1 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Mood Trend (Last 14 Days)
                </h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: number) => [MOOD_LABELS[v]?.label ?? v, 'Mood']}
                      />
                      <Bar
                        dataKey="mood"
                        radius={[4, 4, 0, 0]}
                        fill="#3B82F6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recent Entries */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Entries</h4>
              <div className="space-y-2">
                {moodLogs.slice(0, 5).map((log) => {
                  const moodInfo = MOOD_LABELS[log.mood_score] ?? { emoji: '❓', label: 'Unknown', color: '#9CA3AF' };
                  return (
                    <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <span className="text-2xl">{moodInfo.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{moodInfo.label}</p>
                        {log.note && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">"{log.note}"</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(log.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {meta && totalPages > 1 && (
              <div className="flex justify-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-xs text-gray-500">
                  Page {meta.page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
