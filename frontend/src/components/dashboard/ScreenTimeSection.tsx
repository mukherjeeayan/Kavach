import { useState, lazy, Suspense } from 'react';
import {
  useDailyScreenTime,
  useScreenTimeLimitAction,
  useScreenTimeSummary,
} from '../../hooks/usePhase1Data';
import { SkeletonChart, SkeletonStats, SkeletonTable } from '../ui/Skeleton';

// Lazy load the entire chart for better code splitting
const ScreenTimeChart = lazy(() => import('./ScreenTimeChart'));

// Chart loading fallback
const ChartLoader = () => (
  <div className="h-48 sm:h-40 flex items-center justify-center">
    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded w-full h-full" />
  </div>
);

const RANGES = ['day', 'week', 'month'] as const;

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function todayLocal(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

interface ScreenTimeSectionProps {
  childId: string | null;
  limitMinutes: number | null;
}

export default function ScreenTimeSection({ childId, limitMinutes }: ScreenTimeSectionProps) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [limitInput, setLimitInput] = useState(limitMinutes?.toString() ?? '');
  const summary = useScreenTimeSummary(childId, range);
  const daily = useDailyScreenTime(childId, todayLocal());
  const saveLimit = useScreenTimeLimitAction(childId);

  const data = summary.data;
  const isLoading = summary.isLoading || daily.isLoading;
  const isError = summary.isError || daily.isError;

  const handleSaveLimit = () => {
    const parsed = Number(limitInput);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1440) {
      return;
    }
    saveLimit.mutate(parsed);
  };

  const handleClearLimit = () => {
    setLimitInput('');
    saveLimit.mutate(null);
  };

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Screen Time</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <SkeletonStats />
          <SkeletonChart />
          <SkeletonTable />
        </div>
      )}

      {isError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load screen time data.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-500 dark:text-gray-400 block mb-1">
                Daily screen-time limit (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={1440}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                placeholder="No limit"
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm w-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
              />
            </div>
            <button
              onClick={handleSaveLimit}
              disabled={saveLimit.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveLimit.isPending ? 'Saving...' : 'Set limit'}
            </button>
            <button
              onClick={handleClearLimit}
              disabled={saveLimit.isPending}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400 w-full">
              {limitMinutes
                ? `Current limit: ${limitMinutes} min/day. The backend alerts you when it's exceeded.`
                : 'No limit set - the child can use apps freely.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total ({range})</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(data?.total_seconds ?? 0)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Top app</p>
              <p className="text-xl font-bold truncate text-gray-900 dark:text-white">
                {data?.by_app[0]?.app_package ?? '—'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {data?.by_app[0] ? formatDuration(data.by_app[0].total_seconds) : ''}
              </p>
            </div>
          </div>

          {data && data.daily.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Per day</p>
              <div className="h-48 sm:h-40">
                <Suspense fallback={<ChartLoader />}>
                  <ScreenTimeChart
                    data={data.daily}
                    limitMinutes={limitMinutes}
                  />
                </Suspense>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">App</th>
                    <th className="px-4 py-2 font-medium hidden sm:table-cell">Category</th>
                    <th className="px-4 py-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.by_app ?? []).map((app) => (
                    <tr key={app.app_package} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">{app.app_package}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{app.app_category}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatDuration(app.total_seconds)}
                      </td>
                    </tr>
                  ))}
                  {(data?.by_app ?? []).length === 0 &&
                    daily.data &&
                    daily.data.length > 0 &&
                    daily.data.map((row) => (
                      <tr key={row.app_package} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2 font-mono text-gray-900 dark:text-gray-100">{row.app_package}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{row.app_category ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">
                          {formatDuration(row.total_seconds)}
                        </td>
                      </tr>
                    ))}
                  {(data?.by_app ?? []).length === 0 && (daily.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                        No usage recorded yet - it appears after the child uses the device.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}