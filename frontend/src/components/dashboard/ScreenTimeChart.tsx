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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHART_MARGIN = { top: 4, right: 8, left: -16, bottom: 0 } as const;
const TICK_STYLE = { fontSize: 11 } as const;

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

interface ScreenTimeChartProps {
  data: Array<{ date_recorded: string; total_seconds: number }>;
  limitMinutes: number | null;
}

export default function ScreenTimeChart({ data, limitMinutes }: ScreenTimeChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date_recorded"
          tickFormatter={(value: string) => {
            const label = DAY_NAMES[new Date(`${value}T00:00:00`).getDay()];
            return label ?? '';
          }}
          tick={TICK_STYLE}
        />
        <YAxis
          tickFormatter={(value: number) => formatDuration(value)}
          tick={TICK_STYLE}
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
  );
}
