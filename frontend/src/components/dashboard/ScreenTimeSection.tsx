import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useDailyScreenTime,
  useScreenTimeLimitAction,
  useScreenTimeSummary,
} from '../../hooks/usePhase1Data';

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
  /** Current daily limit in minutes (null = no limit). */
  limitMinutes: number | null;
}

export default function ScreenTimeSection({ childId, limitMinutes }: ScreenTimeSectionProps) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [limitInput, setLimitInput] = useState(limitMinutes?.toString() ?? '');
  const summary = useScreenTimeSummary(childId, range);
  const daily = useDailyScreenTime(childId, todayLocal());
  const saveLimit = useScreenTimeLimitAction(childId);

  const data = summary.data;

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

      <div className="bg-white rounded-lg p-4 border mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-sm text-gray-500 block mb-1">
            Daily screen-time limit (minutes)
          </label>
          <input
            type="number"
            min={0}
            max={1440}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            placeholder="No limit"
            className="border rounded-md px-3 py-2 text-sm w-32"
          />
        </div>
        <button
          onClick={handleSaveLimit}
          disabled={saveLimit.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saveLimit.isPending ? 'Saving…' : 'Set limit'}
        </button>
        <button
          onClick={handleClearLimit}
          disabled={saveLimit.isPending}
          className="px-4 py-2 bg-white border text-gray-600 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Clear
        </button>
        <p className="text-sm text-gray-500">
          {limitMinutes
            ? `Current limit: ${limitMinutes} min/day. The backend alerts you when it's exceeded.`
            : 'No limit set — the child can use apps freely.'}
        </p>
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
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date_recorded"
                  tickFormatter={(value: string) => {
                    const label = DAY_NAMES[new Date(`${value}T00:00:00`).getDay()];
                    return label ?? '';
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(value: number) => formatDuration(value)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => formatDuration(Number(value))}
                  labelFormatter={(value) =>
                    new Date(`${value}T00:00:00`).toLocaleDateString()
                  }
                />
                {limitMinutes != null && limitMinutes > 0 && (
                  <ReferenceLine
                    y={limitMinutes * 60}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: `limit ${limitMinutes}m`, fontSize: 10, fill: '#b45309' }}
                  />
                )}
                <Bar dataKey="total_seconds" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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