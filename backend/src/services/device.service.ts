// device.service.ts
// Device lifecycle: registration + heartbeat. The child's Android app
// registers once after the parent logs in and stores the returned
// device_id locally; subsequent starts re-register to refresh metadata.

import { query } from '../config/database';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { verifyChildBelongsToParent } from './children.service';

export interface RegisteredDevice {
  device_id: string;
  child_id: string;
  device_name: string;
  device_type: string;
  os_version: string | null;
  fcm_token: string | null;
}

export interface RegisterDeviceInput {
  child_id: string;
  device_id?: string;
  device_name: string;
  device_type: string;
  os_version?: string;
  fcm_token?: string;
}

/**
 * Register (or refresh) a device for a child the parent owns.
 * - With an existing device_id: validates ownership, updates metadata,
 *   and returns the same device (idempotent re-registration).
 * - Without one: creates a new device row.
 */
export const registerDevice = async (
  parentId: string,
  input: RegisterDeviceInput
): Promise<RegisteredDevice> => {
  await verifyChildBelongsToParent(input.child_id, parentId);

  if (input.device_id) {
    const existing = await query(
      `SELECT id, child_id FROM devices WHERE id = $1`,
      [input.device_id]
    );
    if (existing.rows.length > 0 && existing.rows[0].child_id !== input.child_id) {
      throw new ForbiddenError('Device does not belong to this child');
    }

    if (existing.rows.length > 0) {
      const updated = await query(
        `UPDATE devices
         SET device_name = $1, device_type = $2, os_version = $3,
             fcm_token = $4, last_active = now()
         WHERE id = $5
         RETURNING id AS device_id, child_id, device_name, device_type,
                   os_version, fcm_token`,
        [
          input.device_name.trim(),
          input.device_type,
          input.os_version || null,
          input.fcm_token || null,
          input.device_id,
        ]
      );
      return updated.rows[0];
    }
  }

  const created = await query(
    `INSERT INTO devices (child_id, device_name, device_type, os_version, fcm_token, last_active)
     VALUES ($1, $2, $3, $4, $5, now())
     RETURNING id AS device_id, child_id, device_name, device_type,
               os_version, fcm_token`,
    [
      input.child_id,
      input.device_name.trim(),
      input.device_type,
      input.os_version || null,
      input.fcm_token || null,
    ]
  );
  return created.rows[0];
};

/**
 * Update a device's last_active timestamp (heartbeat).
 */
export const touchDevice = async (
  parentId: string,
  deviceId: string
): Promise<void> => {
  const result = await query(
    `UPDATE devices SET last_active = now()
     WHERE id = $1
       AND child_id IN (SELECT id FROM children WHERE parent_id = $2)`,
    [deviceId, parentId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Device not found for this parent');
  }
};

/**
 * List the registered devices of a child the parent owns
 * (needed by the dashboard to target rules at the right device).
 */
export const listDevicesForChild = async (
  parentId: string,
  childId: string
): Promise<RegisteredDevice[]> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `SELECT id AS device_id, child_id, device_name, device_type,
            os_version, fcm_token, last_active
     FROM devices
     WHERE child_id = $1
     ORDER BY created_at ASC`,
    [childId]
  );
  return result.rows;
};