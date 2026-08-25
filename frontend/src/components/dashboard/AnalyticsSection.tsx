import { useState } from 'react';
import { useGenerateReport, useLatestReport } from '../../hooks/useAnalytics';
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
