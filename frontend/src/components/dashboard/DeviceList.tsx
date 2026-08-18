import type { DeviceProfile } from '../../types/api';

interface DeviceListProps {
  devices: DeviceProfile[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
}

export default function DeviceList({ devices, selectedDeviceId, onSelect }: DeviceListProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Devices</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {devices.map((device) => (
          <div
            key={device.device_id}
            className={`bg-white rounded-lg p-4 border cursor-pointer transition-colors ${
              selectedDeviceId === device.device_id
                ? 'border-primary ring-1 ring-primary'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelect(device.device_id)}
          >
            <p className="font-medium">{device.device_name}</p>
            <p className="text-sm text-gray-500">
              {device.device_type} · OS {device.os_version ?? 'unknown'}
            </p>
            {device.last_active && (
              <p className="text-xs text-gray-400">
                Last active: {new Date(device.last_active).toLocaleString()}
              </p>
            )}
          </div>
        ))}
        {devices.length === 0 && (
          <p className="text-sm text-gray-500 col-span-full">
            No registered devices. Install the app on the child&apos;s device.
          </p>
        )}
      </div>
    </section>
  );
}
