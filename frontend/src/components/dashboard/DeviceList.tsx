import { memo } from 'react';
import type { DeviceProfile } from '../../types/api';

interface DeviceListProps {
  devices: DeviceProfile[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
}

export default memo(function DeviceList({ devices, selectedDeviceId, onSelect }: DeviceListProps) {
  return (
    <section className="animate-fade-in">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Devices</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {devices.map((device) => (
          <div
            key={device.device_id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedDeviceId === device.device_id}
            className={`bg-white dark:bg-gray-800 rounded-lg p-4 border cursor-pointer transition-colors ${
              selectedDeviceId === device.device_id
                ? 'border-primary ring-1 ring-primary dark:border-blue-400 dark:ring-blue-400'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => onSelect(device.device_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(device.device_id);
              }
            }}
          >
            <p className="font-medium text-gray-900 dark:text-white">{device.device_name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {device.device_type} · OS {device.os_version ?? 'unknown'}
            </p>
            <p className="text-xs mt-1">
              {device.admin_active ? (
                <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Protected (device admin active)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Admin not active — app can be uninstalled
                </span>
              )}
            </p>
            {device.last_active && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last active: {new Date(device.last_active).toLocaleString()}
              </p>
            )}
          </div>
        ))}
        {devices.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 col-span-full text-center">
            <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No registered devices. Install the app on the child's device.
            </p>
          </div>
        )}
      </div>
    </section>
  );
});
