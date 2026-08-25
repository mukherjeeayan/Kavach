import { useState } from 'react';
import { useCommunicationLogs } from '../../hooks/useCommunications';
import { SkeletonTable } from '../ui/Skeleton';

interface Props {
  childId: string;
}

const COMM_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  SMS_IN: { label: 'SMS Received', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  SMS_OUT: { label: 'SMS Sent', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  CALL_IN: { label: 'Call Received', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  CALL_OUT: { label: 'Call Made', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  CALL_MISSED: { label: 'Missed Call', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function CommunicationSection({ childId }: Props) {
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [revealedContent, setRevealedContent] = useState<Set<string>>(new Set());

  const { data, isLoading } = useCommunicationLogs(childId, flaggedOnly, page);
  const logs = data?.data ?? [];
  const meta = data?.meta;

  const toggleReveal = (id: string) => {
    setRevealedContent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <SkeletonTable rows={5} />;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Communication Logs</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">SMS and call history</p>
            </div>
          </div>
          <button
            onClick={() => { setFlaggedOnly(!flaggedOnly); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              flaggedOnly
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {flaggedOnly ? 'Showing Flagged' : 'Show Flagged Only'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No communication logs recorded yet.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Content</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {logs.map((log) => {
                    const typeInfo = COMM_TYPE_LABELS[log.comm_type] ?? { label: log.comm_type, color: 'bg-gray-100 text-gray-700', icon: '' };
                    const isRevealed = revealedContent.has(log.id);
                    return (
                      <tr key={log.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${log.is_flagged ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="py-3 text-gray-900 dark:text-white">
                          {log.contact_name || log.contact_number || '-'}
                        </td>
                        <td className="py-3 max-w-[200px]">
                          {log.content_snippet ? (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 dark:text-gray-300 text-xs truncate">
                                {isRevealed ? log.content_snippet : '••••••••'}
                              </span>
                              <button
                                onClick={() => toggleReveal(log.id)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  {isRevealed ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                  ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  )}
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {formatDuration(log.duration_seconds)}
                        </td>
                        <td className="py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(log.recorded_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {meta && meta.total_pages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="px-3 py-1 text-xs text-gray-500">
                  Page {meta.page} of {meta.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                  disabled={page === meta.total_pages}
                  className="px-3 py-1 text-xs border rounded-lg disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
