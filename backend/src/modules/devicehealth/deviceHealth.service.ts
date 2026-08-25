// deviceHealth.service.ts
// Records and retrieves device health telemetry (battery, storage,
// root/debug status).

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';

export interface DeviceHealthInput {
  battery_level?: number;
  is_charging?: boolean;
  storage_total_mb?: number;
  storage_free_mb?: number;
  is_rooted?: boolean;
  is_developer_options?: boolean;
  is_usb_debugging?: boolean;
  os_version?: string;
  app_version?: string;
}

/**
 * Record a health snapshot from the device.
 */
export const recordHealth = async (
  parentId: string,
  deviceId: string,
  input: DeviceHealthInput
) => {
  // Verify device ownership
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this parent');

  const result = await query(
    `INSERT INTO device_health_logs
     (device_id, battery_level, is_charging, storage_total_mb, storage_free_mb,
      is_rooted, is_developer_options, is_usb_debugging, os_version, app_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      deviceId,
      input.battery_level ?? null,
      input.is_charging ?? null,
      input.storage_total_mb ?? null,
      input.storage_free_mb ?? null,
      input.is_rooted ?? false,
      input.is_developer_options ?? false,
      input.is_usb_debugging ?? false,
      input.os_version ?? null,
      input.app_version ?? null,
    ]
  );

  // Alert on security concerns
  if (input.is_rooted || input.is_usb_debugging) {
    await writeAuditLog({
      actorId: parentId,
      targetChildId: device.rows[0].child_id,
      action: 'DEVICE_SECURITY_ALERT',
      resourceType: 'device_health_logs',
      details: {
        device_id: deviceId,
        is_rooted: input.is_rooted,
        is_usb_debugging: input.is_usb_debugging,
      },
    });
  }

  return result.rows[0];
};

/**
 * Get the latest health snapshot for a device (parent view).
 */
export const getLatestHealth = async (
  parentId: string,
  childId: string,
  deviceId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT * FROM device_health_logs
     WHERE device_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [deviceId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
};

/**
 * Get health history for a device (last N entries, for charts).
 */
export const getHealthHistory = async (
  parentId: string,
  childId: string,
  deviceId: string,
  limit: number = 48
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT * FROM device_health_logs
     WHERE device_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2`,
    [deviceId, limit]
  );
  return result.rows;
};
