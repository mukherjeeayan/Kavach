// sos.service.ts
// Emergency SOS event management: create, acknowledge, resolve.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { sendPushToAllParents } from '../shared/pushNotificationService';
import { sendSosSmsFallback } from '../shared/smsService';
import logger from '../../utils/logger';

export interface SosEventInput {
  latitude?: number;
  longitude?: number;
  battery_level?: number;
  trigger_method?: 'BUTTON' | 'WIDGET' | 'VOICE' | 'HARDWARE_KEY';
}

/**
 * Create a new SOS event (device-side trigger).
 */
export const createSosEvent = async (
  parentId: string,
  deviceId: string,
  input: SosEventInput
) => {
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this parent');

  const childId = device.rows[0].child_id;

  const result = await query(
    `INSERT INTO emergency_sos_events
     (device_id, child_id, latitude, longitude, battery_level, trigger_method)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      deviceId,
      childId,
      input.latitude ?? null,
      input.longitude ?? null,
      input.battery_level ?? null,
      input.trigger_method ?? 'BUTTON',
    ]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SOS_TRIGGERED',
    resourceType: 'emergency_sos_events',
    details: {
      event_id: result.rows[0].id,
      device_id: deviceId,
      trigger_method: input.trigger_method ?? 'BUTTON',
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });

  // Send high-priority FCM: bypasses Doze, battery optimization,
  // and app standby to ensure immediate delivery of emergency alerts.
  await sendPushToAllParents(
    childId,
    'SOS Alert',
    `Emergency SOS triggered (${input.trigger_method ?? 'BUTTON'})`,
    {
      type: 'sos',
      event_id: result.rows[0].id,
      child_id: childId,
    },
    'high'
  );

  // SMS fallback: if FCM fails or parent devices are offline,
  // deliver the emergency alert via SMS (dual-channel delivery).
  try {
    const parentPhoneResult = await query(
      `SELECT p.phone_number
       FROM parents p
       JOIN children c ON c.parent_id = p.id
       WHERE c.id = $1 AND p.phone_number IS NOT NULL AND p.phone_number != ''`,
      [childId]
    );

    if (parentPhoneResult.rows.length > 0) {
      const phoneNumbers = parentPhoneResult.rows.map((r: any) => r.phone_number);
      const childNameResult = await query(
        `SELECT name FROM children WHERE id = $1`,
        [childId]
      );
      const childName = childNameResult.rows[0]?.name ?? 'Your child';

      await sendSosSmsFallback(
        phoneNumbers,
        childName,
        input.latitude,
        input.longitude
      );
    }
  } catch (smsErr) {
    // SMS failure must never crash the SOS flow — FCM already succeeded
    logger.error('SMS fallback for SOS failed (FCM was delivered):', smsErr);
  }

  return result.rows[0];
};

/**
 * List SOS events for a child (parent view).
 */
export const listSosEvents = async (
  parentId: string,
  childId: string,
  status?: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const params: unknown[] = [childId];
  let whereClause = 'WHERE child_id = $1';

  if (status) {
    whereClause += ` AND status = $2`;
    params.push(status);
  }

  const result = await query(
    `SELECT * FROM emergency_sos_events
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT 50`,
    params
  );
  return result.rows;
};

/**
 * Acknowledge an SOS event (parent marks it as seen).
 */
export const acknowledgeSos = async (
  parentId: string,
  childId: string,
  eventId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `UPDATE emergency_sos_events
     SET status = 'ACKNOWLEDGED', acknowledged_at = now()
     WHERE id = $1 AND child_id = $2 AND status = 'ACTIVE'
     RETURNING *`,
    [eventId, childId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Active SOS event not found');

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SOS_ACKNOWLEDGED',
    resourceType: 'emergency_sos_events',
    details: { event_id: eventId },
  });

  return result.rows[0];
};

/**
 * Resolve an SOS event (parent marks it as handled).
 */
export const resolveSos = async (
  parentId: string,
  childId: string,
  eventId: string,
  notes?: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `UPDATE emergency_sos_events
     SET status = 'RESOLVED', resolved_at = now(), notes = COALESCE($3, notes)
     WHERE id = $1 AND child_id = $2 AND status IN ('ACTIVE', 'ACKNOWLEDGED')
     RETURNING *`,
    [eventId, childId, notes ?? null]
  );
  if (result.rows.length === 0) throw new NotFoundError('SOS event not found or already resolved');

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SOS_RESOLVED',
    resourceType: 'emergency_sos_events',
    details: { event_id: eventId, notes },
  });

  return result.rows[0];
};
