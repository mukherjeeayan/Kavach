import { useState } from 'react';
import { useSecurityScans, useWifiLogs } from '../../hooks/usePredictions';
import { SkeletonTable } from '../ui/Skeleton';

interface Props {
  childId: string;
  deviceId: string | null;
}

export default function SecuritySection({ childId, deviceId }: Props) {
  const [tab, setTab] = useState<'scans' | 'wifi'>('scans');
  const { data: scans, isLoading: scansLoading } = useSecurityScans(childId, deviceId);
  const { data: wifiLogs, isLoading: wifiLoading } = useWifiLogs(childId, deviceId);

  if (!deviceId) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Select a device to view security information.
        </p>
      </section>
    );
  }

  if (scansLoading || wifiLoading) return <SkeletonTable rows={3} />;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Scans and network monitoring</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setTab('scans')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'scans'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Security Scans
          </button>
          <button
            onClick={() => setTab('wifi')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'wifi'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            WiFi History
          </button>
        </div>
      </div>

      <div className="p-6">
        {tab === 'scans' && (
          <>
            {(scans ?? []).length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🛡️</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No security scans recorded yet. Scans are performed automatically by the device.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(scans ?? []).slice(0, 10).map((scan) => (
                  <div
                    key={scan.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      scan.threats_found > 0
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${scan.threats_found > 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{scan.scan_type} Scan</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(scan.scanned_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${scan.threats_found > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {scan.threats_found} threat{scan.threats_found !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'wifi' && (
          <>
            {(wifiLogs ?? []).length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📶</div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No WiFi connection logs recorded yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="pb-2 font-medium">Network</th>
                      <th className="pb-2 font-medium">Security</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {(wifiLogs ?? []).slice(0, 20).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2 text-gray-900 dark:text-white font-mono text-xs">
                          {log.ssid || 'Unknown'}
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.is_open
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          }`}>
                            {log.is_open ? 'Open' : log.security_type || 'Secured'}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`text-xs ${log.is_known ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {log.is_known ? 'Known' : 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(log.recorded_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
