// deviceAlert.service.ts
// Backend side of the Android bypass/tamper-detection alert.

import { query } from '../config/database';
import logger from '../utils/logger';

/**
 * Record a tamper alert from a device in the audit log.
 * The device itself reports signals (root, debugger); the backend
 * persists the event so the parent portal can surface it later.
 */
export const reportTamperAlert = async (
  actorId: string,
  deviceId: string,
  details: string
): Promise<void> => {
  await query(
    `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
     VALUES ($1, NULL, $2, $3, $4)`,
    [
      actorId,
      'TAMPER_ALERT',
      'device',
      JSON.stringify({ device_id: deviceId, details }),
    ]
  );
  logger.warn(`Tamper alert recorded: device ${deviceId} (${details})`);
};