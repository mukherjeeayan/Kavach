// deviceAlert.service.ts
// Backend side of the Android bypass/tamper-detection alert.

import { query } from '../config/database';
import { NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Record a tamper alert from a device in the audit log.
 * The device itself reports signals (root, debugger); the backend
 * persists the event so the parent portal can surface it later.
 * The device must belong to a child of the authenticated parent —
 * otherwise a parent could write alerts against arbitrary devices.
 */
export const reportTamperAlert = async (
  parentId: string,
  deviceId: string,
  details: string
): Promise<void> => {
  const device = await query(
    `SELECT d.id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) {
    throw new NotFoundError('Device not found for this parent');
  }

  await query(
    `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
     VALUES ($1, NULL, $2, $3, $4)`,
    [
      parentId,
      'TAMPER_ALERT',
      'device',
      JSON.stringify({ device_id: deviceId, details }),
    ]
  );
  logger.warn(`Tamper alert recorded: device ${deviceId} (${details})`);
};