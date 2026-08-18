import { useState } from 'react';
import { useDailyScreenTime, useScreenTimeSummary } from '../../hooks/usePhase1Data';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
}

export default function ScreenTimeSection({ childId }: ScreenTimeSectionProps) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const summary = useScreenTimeSummary(childId, range);
  const daily = useDailyScreenTime(childId, todayLocal());

  const data = summary.data;
  const maxDaily = Math.max(...(data?.daily.map((d) => d.total_seconds) ?? [1]), 1);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Screen Time</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-gray-500">Total ({range})</p>
          <p className="text-2xl font-bold">{formatDuration(data?.total_seconds ?? 0)}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-sm text-gray-500">Top app</p>
          <p className="text-xl font-bold truncate">
            {data?.by_app[0]?.app_package ?? '—'}
          </p>
          <p className="text-sm text-gray-500">
            {data?.by_app[0] ? formatDuration(data.by_app[0].total_seconds) : ''}
          </p>
        </div>
      </div>

      {data && data.daily.length > 0 && (
        <div className="bg-white rounded-lg p-4 border mb-4">
          <p className="text-sm text-gray-500 mb-2">Per day</p>
          <div className="flex items-end gap-1.5 h-24">
            {data.daily.map((d) => {
              const label = DAY_NAMES[new Date(`${d.date_recorded}T00:00:00`).getDay()];
              const height = `${Math.max((d.total_seconds / maxDaily) * 100, 4)}%`;
              return (
                <div key={d.date_recorded} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height }}
                    title={`${label}: ${formatDuration(d.total_seconds)}`}
                  />
                  <span className="text-[10px] text-gray-400">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">App</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data?.by_app ?? []).map((app) => (
              <tr key={app.app_package} className="border-t">
                <td className="px-4 py-2 font-mono">{app.app_package}</td>
                <td className="px-4 py-2 text-gray-500">{app.app_category}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {formatDuration(app.total_seconds)}
                </td>
              </tr>
            ))}
            {(data?.by_app ?? []).length === 0 &&
              daily.data &&
              daily.data.length > 0 &&
              daily.data.map((row) => (
                <tr key={row.app_package} className="border-t">
                  <td className="px-4 py-2 font-mono">{row.app_package}</td>
                  <td className="px-4 py-2 text-gray-500">{row.app_category ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatDuration(row.total_seconds)}
                  </td>
                </tr>
              ))}
            {(data?.by_app ?? []).length === 0 && (daily.data ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  No usage recorded yet — it appears after the child uses the device.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}