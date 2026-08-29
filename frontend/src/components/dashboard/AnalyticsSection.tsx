import { useState } from 'react';
import { useGenerateReport, useLatestReport } from '../../hooks/useAnalytics';
import { useChildren } from '../../hooks/useChildrenData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { SkeletonCard } from '../ui/Skeleton';

interface Props {
  childId: string;
  onError: (msg: string | null) => void;
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AnalyticsSection({ childId, onError }: Props) {
  const [reportType, setReportType] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const { data: report, isLoading: reportLoading } = useLatestReport(childId, reportType);
  const { data: children } = useChildren();
  const generateReport = useGenerateReport(childId);

  const handleGenerate = async () => {
    try {
      await generateReport.mutateAsync(reportType);
    } catch {
      onError('Failed to generate report');
    }
  };

  const childName = children?.find((c) => c.id === childId)?.name ?? 'Child';

  const computeSafetyScore = (data: Record<string, unknown>): number => {
    const st = (data.screen_time as { grand_total_seconds?: number } | undefined)?.grand_total_seconds ?? 0;
    const alerts = (data.keyword_alerts as Array<{ count: number }> | undefined) ?? [];
    const alertCount = alerts.reduce((s, a) => s + (a.count ?? 0), 0);
    const days = Math.max(1, report?.period_start && report?.period_end
      ? Math.max(1, Math.ceil((new Date(report.period_end).getTime() - new Date(report.period_start).getTime()) / 86_400_000))
      : 7);
    const dailyHours = st / 3600 / days;
    const usagePenalty = Math.min(40, dailyHours * 4);
    const alertPenalty = Math.min(50, alertCount * 5);
    return Math.max(0, Math.round(100 - usagePenalty - alertPenalty));
  };

  const handleExport = () => {
    if (!reportData) return;
    const data = reportData as Record<string, unknown>;
    const st = (data.screen_time as { grand_total_seconds?: number; by_app?: Array<{ app_package: string; total_seconds: number }> } | undefined);
    const loc = (data.location as { total_pings?: number } | undefined);
    const comms = (data.communications as Array<{ comm_type: string; count: number }> | undefined) ?? [];
    const alerts = (data.keyword_alerts as Array<{ severity: string; count: number }> | undefined) ?? [];
    const totalComms = comms.reduce((s, c) => s + (c.count ?? 0), 0);
    const totalAlerts = alerts.reduce((s, a) => s + (a.count ?? 0), 0);
    const safetyScore = computeSafetyScore(data);
    const periodStart = report?.period_start ? new Date(report.period_start).toLocaleDateString() : '-';
    const periodEnd = report?.period_end ? new Date(report.period_end).toLocaleDateString() : '-';
    const topApps = (st?.by_app ?? []).slice(0, 5)
      .map((a) => `<tr><td>${a.app_package}</td><td>${formatSeconds(a.total_seconds)}</td></tr>`)
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${childName} Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 800px; margin: 24px auto; padding: 0 16px; }
  h1 { color: #1d4ed8; margin-bottom: 4px; }
  h2 { margin-top: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
  .meta { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 12px 0; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .card .label { font-size: 12px; color: #6b7280; }
  .card .value { font-size: 24px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; }
  .score-good { color: #059669; }
  .score-warn { color: #d97706; }
  .score-bad { color: #dc2626; }
  @media print { .no-print { display: none; } body { margin: 0; } }
</style></head><body>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 16px;background:#1d4ed8;color:#fff;border:0;border-radius:6px;cursor:pointer;">Print / Save as PDF</button>
<h1>Kavach ${reportType.toLowerCase()} report — ${childName}</h1>
<div class="meta">Period: ${periodStart} — ${periodEnd} • Generated: ${new Date(report!.generated_at).toLocaleString()}</div>

<h2>Summary</h2>
<div class="grid">
  <div class="card"><div class="label">Safety score</div><div class="value ${
    safetyScore >= 75 ? 'score-good' : safetyScore >= 50 ? 'score-warn' : 'score-bad'
  }">${safetyScore}/100</div></div>
  <div class="card"><div class="label">Alerts</div><div class="value">${totalAlerts}</div></div>
  <div class="card"><div class="label">Total screen time</div><div class="value">${formatSeconds(st?.grand_total_seconds ?? 0)}</div></div>
  <div class="card"><div class="label">Location pings</div><div class="value">${loc?.total_pings ?? 0}</div></div>
  <div class="card"><div class="label">Communications</div><div class="value">${totalComms}</div></div>
</div>

<h2>Alerts by severity</h2>
${alerts.length === 0 ? '<p>No keyword alerts in this period.</p>' :
  `<table><thead><tr><th>Severity</th><th>Count</th></tr></thead><tbody>${alerts.map((a) =>
    `<tr><td>${a.severity}</td><td>${a.count}</td></tr>`).join('')}</tbody></table>`}

<h2>Top apps</h2>
${topApps ? `<table><thead><tr><th>Package</th><th>Time</th></tr></thead><tbody>${topApps}</tbody></table>` : '<p>No app usage data.</p>'}
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 250);
    }
  };

  if (reportLoading) return <SkeletonCard />;

  const reportData = report?.data as Record<string, unknown> | undefined;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Analytics & Reports</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {report ? `Generated ${new Date(report.generated_at).toLocaleString()}` : 'No reports yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'WEEKLY' | 'MONTHLY')}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <button
              onClick={handleGenerate}
              disabled={generateReport.isPending}
              className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generateReport.isPending ? 'Generating...' : 'Generate'}
            </button>
            <button
              onClick={handleExport}
              disabled={!reportData}
              className="px-4 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {!reportData ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-4">No report generated yet.</p>
            <button
              onClick={handleGenerate}
              disabled={generateReport.isPending}
              className="px-6 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Generate Your First {reportType === 'WEEKLY' ? 'Weekly' : 'Monthly'} Report
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Screen Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatSeconds((reportData.screen_time as { grand_total_seconds: number })?.grand_total_seconds ?? 0)}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Location Pings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(reportData.location as { total_pings: number })?.total_pings ?? 0}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Communications</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(reportData.communications as Array<{ count: number }>)?.reduce((s, c) => s + (c.count ?? 0), 0) ?? 0}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">Keyword Alerts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(reportData.keyword_alerts as Array<{ count: number }>)?.reduce((s, a) => s + (a.count ?? 0), 0) ?? 0}
                </p>
              </div>
            </div>

            {/* Screen Time Chart */}
            {(reportData.screen_time as { daily_totals: Array<{ date_recorded: string; total_seconds: number }> })?.daily_totals?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Daily Screen Time</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
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
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {(reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> })?.by_category?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Usage by Category</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={
                          ((reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> }).by_category).map((c) => ({
                            name: c.category || 'Unknown',
                            value: c.total_seconds,
                          }))
                        }
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {
                          ((reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> }).by_category).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))
                        }
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatSeconds(v), 'Time']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {((reportData.screen_time as { by_category: Array<{ category: string; total_seconds: number }> }).by_category).map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600 dark:text-gray-400">{c.category || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
