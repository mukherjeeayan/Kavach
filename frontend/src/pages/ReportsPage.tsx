import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChildren } from '../hooks/useChildrenData';
import { useGenerateReport, useLatestReport, useReports } from '../hooks/useAnalytics';
import { useScreenTimeSummary } from '../hooks/usePhase1Data';
import { useCommunicationLogs } from '../hooks/useCommunications';
import { useCurrentLocations } from '../hooks/usePhase1Data';
import { SkeletonCard, SkeletonList } from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

type ReportTab = 'overview' | 'safety' | 'location' | 'usage' | 'communication';
const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ReportsPage() {
  const { data: children, isLoading: childrenLoading } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTab>('overview');
  const [toast, setToast] = useState<string | null>(null);
  const childId = selectedChildId ?? children?.[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">SafeGuard</Link>
          <Link to="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">Back to Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          {children && children.length > 1 && (
            <select
              value={childId ?? ''}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {childrenLoading && <SkeletonCard />}

        {childId && (
          <>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {(['overview', 'safety', 'location', 'usage', 'communication'] as ReportTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    tab === t
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {tab === 'overview' && <OverviewTab childId={childId} onError={setToast} />}
            {tab === 'safety' && <SafetyTab childId={childId} />}
            {tab === 'location' && <LocationTab childId={childId} />}
            {tab === 'usage' && <UsageTab childId={childId} />}
            {tab === 'communication' && <CommunicationTab childId={childId} />}
          </>
        )}
      </main>

      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </div>
  );
}

function OverviewTab({ childId, onError }: { childId: string; onError: (m: string | null) => void }) {
  const [reportType, setReportType] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const { data: report, isLoading: reportLoading } = useLatestReport(childId, reportType);
  const { data: reports } = useReports(childId);
  const generateReport = useGenerateReport(childId);

  const handleGenerate = async () => {
    try {
      await generateReport.mutateAsync(reportType);
    } catch {
      onError('Failed to generate report');
    }
  };

  if (reportLoading) return <SkeletonCard />;

  const reportData = report?.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {report ? `Latest ${report.report_type.toLowerCase()} report — generated ${new Date(report.generated_at).toLocaleString()}` : 'No reports yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={reportType} onChange={(e) => setReportType(e.target.value as 'WEEKLY' | 'MONTHLY')} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          <button onClick={handleGenerate} disabled={generateReport.isPending} className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {generateReport.isPending ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {!reportData ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No report generated yet.</p>
          <button onClick={handleGenerate} disabled={generateReport.isPending} className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            Generate Your First Report
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Screen Time" value={formatSeconds((reportData.screen_time as { grand_total_seconds: number })?.grand_total_seconds ?? 0)} color="blue" />
            <StatCard label="Location Pings" value={String((reportData.location as { total_pings: number })?.total_pings ?? 0)} color="green" />
            <StatCard label="Communications" value={String((reportData.communications as Array<{ count: number }>)?.reduce((s, c) => s + (c.count ?? 0), 0) ?? 0)} color="purple" />
            <StatCard label="Keyword Alerts" value={String((reportData.keyword_alerts as Array<{ count: number }>)?.reduce((s, a) => s + (a.count ?? 0), 0) ?? 0)} color="red" />
          </div>

          {(reportData.screen_time as { daily_totals: Array<{ date_recorded: string; total_seconds: number }> })?.daily_totals?.length > 0 && (
            <ChartCard title="Daily Screen Time">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={
                  ((reportData.screen_time as { daily_totals: Array<{ date_recorded: string; total_seconds: number }> }).daily_totals).map((d) => ({
                    date: d.date_recorded.slice(5),
                    hours: Number((d.total_seconds / 3600).toFixed(1)),
                  }))
                }>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Screen Time']} />
                  <Bar dataKey="hours" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {(reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> })?.by_category?.length > 0 && (
            <ChartCard title="Usage by Category">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={
                      ((reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> }).by_category).map((c) => ({
                        name: c.category || 'Unknown',
                        value: c.total_seconds,
                      }))
                    }
                    cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value"
                  >
                    {((reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> }).by_category).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [formatSeconds(v), 'Time']} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {reports && reports.length > 1 && (
            <ChartCard title="Report History">
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{r.report_type} Report</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(r.period_start).toLocaleDateString()} — {new Date(r.period_end).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.generated_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

function SafetyTab({ childId }: { childId: string }) {
  const { data: alerts, isLoading } = useLatestReport(childId, 'WEEKLY');
  const reportData = alerts?.data as Record<string, unknown> | undefined;
  const keywordAlerts = (reportData?.keyword_alerts as Array<{ severity: string; count: number }>) ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Safety Report</h2>
      {isLoading ? <SkeletonCard /> : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Keyword Alerts by Severity</h3>
            {keywordAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No keyword alerts in this report.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={keywordAlerts.map((k) => ({ severity: k.severity, count: k.count }))}>
                  <XAxis dataKey="severity" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Safety Summary</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {keywordAlerts.length === 0
                ? 'No safety issues detected in the reporting period.'
                : `${keywordAlerts.reduce((s, k) => s + k.count, 0)} keyword alerts across ${keywordAlerts.length} severity levels.`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationTab({ childId }: { childId: string }) {
  const { data: locations, isLoading } = useCurrentLocations(childId);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Location Report</h2>
      {isLoading ? <SkeletonList items={3} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Current Location Pings ({(locations ?? []).length})</h3>
          {(locations ?? []).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No location data available.</p>
          ) : (
            <div className="space-y-2">
              {(locations ?? []).slice(0, 10).map((loc) => (
                <div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {loc.accuracy_m ? `Accuracy: ${loc.accuracy_m}m` : ''} {loc.speed_kmh ? `Speed: ${loc.speed_kmh} km/h` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(loc.recorded_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UsageTab({ childId }: { childId: string }) {
  const [range, setRange] = useState<'day' | 'week' | 'month'>('week');
  const { data: summary, isLoading } = useScreenTimeSummary(childId, range);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Usage Report</h2>
        <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>
      {isLoading ? <SkeletonCard /> : summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Screen Time" value={formatSeconds(summary.total_seconds)} color="blue" />
            <StatCard label="Days Tracked" value={String(summary.daily.length)} color="green" />
          </div>

          {summary.daily.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Daily Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={summary.daily.map((d) => ({ date: d.date_recorded.slice(5), hours: Number((d.total_seconds / 3600).toFixed(1)) }))}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Screen Time']} />
                  <Line type="monotone" dataKey="hours" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {summary.by_app.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Top Apps</h3>
              <div className="space-y-2">
                {summary.by_app.slice(0, 10).map((app) => (
                  <div key={app.app_package} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{app.app_category}</span>
                      <span className="text-sm text-gray-900 dark:text-white truncate max-w-[200px]">{app.app_package.split('.').pop()}</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{formatSeconds(app.total_seconds)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommunicationTab({ childId }: { childId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCommunicationLogs(childId, false, page);
  const logs = data?.data ?? [];
  const meta = data?.meta;

  const commTypeCounts = logs.reduce((acc, log) => {
    acc[log.comm_type] = (acc[log.comm_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Communication Report</h2>
      {isLoading ? <SkeletonList items={3} /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(commTypeCounts).map(([type, count]) => (
              <div key={type} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{type.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Contact</th>
                    <th className="px-6 py-3 font-medium">Content</th>
                    <th className="px-6 py-3 font-medium">Duration</th>
                    <th className="px-6 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {logs.map((log) => (
                    <tr key={log.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${log.is_flagged ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-6 py-3"><span className="text-xs font-medium">{log.comm_type}</span></td>
                      <td className="px-6 py-3 text-gray-900 dark:text-white">{log.contact_name || log.contact_number || '-'}</td>
                      <td className="px-6 py-3 max-w-[200px] truncate text-gray-600 dark:text-gray-300 text-xs">{log.content_snippet ?? '-'}</td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{log.duration_seconds ? `${Math.floor(log.duration_seconds / 60)}m` : '-'}</td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(log.recorded_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && meta.total_pages > 1 && (
              <div className="flex justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50">Prev</button>
                <span className="px-3 py-1 text-xs text-gray-500">Page {meta.page} of {meta.total_pages}</span>
                <button onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))} disabled={page === meta.total_pages} className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50">Next</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };
  return (
    <div className={`${colorMap[color] ?? colorMap.blue} rounded-lg p-4`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h4>
      {children}
    </div>
  );
}
