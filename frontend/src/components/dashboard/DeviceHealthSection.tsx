import { useDeviceHealth } from '../../hooks/useDeviceHealth';
import { SkeletonCard } from '../ui/Skeleton';

interface Props {
  childId: string;
  deviceId: string | null;
}

function getBatteryColor(level: number | null): string {
  if (level === null) return 'bg-gray-300';
  if (level > 60) return 'bg-green-500';
  if (level > 20) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getStoragePercent(total: number | null, free: number | null): number | null {
  if (!total || total === 0) return null;
  return Math.round(((total - (free ?? 0)) / total) * 100);
}

export default function DeviceHealthSection({ childId, deviceId }: Props) {
  const { data: health, isLoading } = useDeviceHealth(childId, deviceId);

  if (!deviceId) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Select a device to view health information.
        </p>
      </section>
    );
  }

  if (isLoading) return <SkeletonCard />;

  if (!health) {
    return (
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          No health data available for this device yet.
        </p>
      </section>
    );
  }

  const storageUsed = getStoragePercent(health.storage_total_mb, health.storage_free_mb);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Device Health</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(health.recorded_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {/* Battery */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Battery</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {health.battery_level ?? '-'}%
              </span>
              {health.is_charging && (
                <span className="text-xs text-green-600 dark:text-green-400 mb-1">Charging</span>
              )}
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBatteryColor(health.battery_level)}`}
                style={{ width: `${health.battery_level ?? 0}%` }}
              />
            </div>
          </div>

          {/* Storage */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Storage</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {storageUsed !== null ? `${storageUsed}%` : '-'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {health.storage_free_mb
                ? `${Math.round(health.storage_free_mb / 1024)}GB free of ${Math.round((health.storage_total_mb ?? 0) / 1024)}GB`
                : 'No data'}
            </p>
          </div>

          {/* Security */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Security</span>
            </div>
            <div className="space-y-1">
              {health.is_rooted ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  ROOTED
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Clean
                </span>
              )}
              {health.is_usb_debugging && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  USB Debug
                </span>
              )}
            </div>
          </div>

          {/* OS Version */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">OS</span>
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {health.os_version || 'Unknown'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              App: {health.app_version || '-'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
