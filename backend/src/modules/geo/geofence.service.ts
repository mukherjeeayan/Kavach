// geofence.service.ts
// CRUD + entry/exit detection for per-child geofences.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent, ensureDeviceBelongsToChild } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset, buildPaginationMeta } from '../../utils/pagination';
import type { CreateGeofenceInput, UpdateGeofenceInput } from './geofence.dto';

const GEOFENCE_COLUMNS = `id, child_id, device_id, name, latitude, longitude, radius_meters,
  zone_type, alert_on_entry, alert_on_exit, is_active, created_at, updated_at`;

/**
 * List all geofences for a child (paginated).
 */
export const listGeofences = async (
  parentId: string,
  childId: string,
  page: number,
  limit: number
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const limitNum = Number(limit) || 50;
  const pageNum = Number(page) || 1;
  const offset = toOffset(pageNum, limitNum);

  const [items, countResult] = await Promise.all([
    query(
      `SELECT ${GEOFENCE_COLUMNS} FROM geofences
       WHERE child_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [childId, limitNum, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM geofences WHERE child_id = $1`,
      [childId]
    ),
  ]);

  return {
    data: items.rows,
    meta: buildPaginationMeta(pageNum, limitNum, countResult.rows[0].total),
  };
};

/**
 * Create a new geofence.
 */
export const createGeofence = async (
  parentId: string,
  childId: string,
  input: CreateGeofenceInput
) => {
  await verifyChildBelongsToParent(childId, parentId);
  if (input.device_id) {
    await ensureDeviceBelongsToChild(childId, input.device_id);
  }

  const result = await query(
    `INSERT INTO geofences
     (child_id, device_id, name, latitude, longitude, radius_meters,
      zone_type, alert_on_entry, alert_on_exit, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${GEOFENCE_COLUMNS}`,
    [
      childId,
      input.device_id || null,
      input.name,
      input.latitude,
      input.longitude,
      input.radius_meters,
      input.zone_type ?? 'CUSTOM',
      input.alert_on_entry ?? false,
      input.alert_on_exit ?? true,
      input.is_active ?? true,
    ]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CREATE_GEOFENCE',
    resourceType: 'geofences',
    details: { geofence_id: result.rows[0].id, name: input.name },
  });

  return result.rows[0];
};

/**
 * Update an existing geofence.
 */
export const updateGeofence = async (
  parentId: string,
  childId: string,
  geofenceId: string,
  input: UpdateGeofenceInput
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const existing = await query(
    `SELECT id FROM geofences WHERE id = $1 AND child_id = $2`,
    [geofenceId, childId]
  );
  if (existing.rows.length === 0) throw new NotFoundError('Geofence not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) { sets.push(`name = $${idx++}`); params.push(input.name); }
  if (input.latitude !== undefined) { sets.push(`latitude = $${idx++}`); params.push(input.latitude); }
  if (input.longitude !== undefined) { sets.push(`longitude = $${idx++}`); params.push(input.longitude); }
  if (input.radius_meters !== undefined) { sets.push(`radius_meters = $${idx++}`); params.push(input.radius_meters); }
  if (input.zone_type !== undefined) { sets.push(`zone_type = $${idx++}`); params.push(input.zone_type); }
  if (input.alert_on_entry !== undefined) { sets.push(`alert_on_entry = $${idx++}`); params.push(input.alert_on_entry); }
  if (input.alert_on_exit !== undefined) { sets.push(`alert_on_exit = $${idx++}`); params.push(input.alert_on_exit); }
  if (input.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(input.is_active); }

  if (sets.length === 0) {
    const current = await query(`SELECT ${GEOFENCE_COLUMNS} FROM geofences WHERE id = $1`, [geofenceId]);
    return current.rows[0];
  }

  params.push(geofenceId);
  const result = await query(
    `UPDATE geofences SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${GEOFENCE_COLUMNS}`,
    params
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'UPDATE_GEOFENCE',
    resourceType: 'geofences',
    details: { geofence_id: geofenceId, changes: input },
  });

  return result.rows[0];
};

/**
 * Delete a geofence.
 */
export const deleteGeofence = async (
  parentId: string,
  childId: string,
  geofenceId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `DELETE FROM geofences WHERE id = $1 AND child_id = $2 RETURNING id`,
    [geofenceId, childId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Geofence not found');

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'DELETE_GEOFENCE',
    resourceType: 'geofences',
    details: { geofence_id: geofenceId },
  });
};

/**
 * Get all active geofences for a child (used by device to sync).
 */
export const getActiveGeofencesForChild = async (childId: string) => {
  const result = await query(
    `SELECT name, latitude, longitude, radius_meters, zone_type, alert_on_entry, alert_on_exit
     FROM geofences
     WHERE child_id = $1 AND is_active = TRUE
     ORDER BY zone_type ASC`,
    [childId]
  );
  return result.rows;
};

/**
 * Check if a location is inside any geofence for a child.
 * Returns an array of geofence violations (entry/exit events).
 */
export const checkGeofences = async (
  childId: string,
  deviceId: string,
  latitude: number,
  longitude: number
): Promise<Array<{
  geofence_id: string;
  name: string;
  zone_type: string;
  event_type: 'ENTRY' | 'EXIT';
}>> => {
  const geofences = await query(
    `SELECT id, name, latitude, longitude, radius_meters, zone_type, alert_on_entry, alert_on_exit
     FROM geofences
     WHERE child_id = $1 AND is_active = TRUE`,
    [childId]
  );

  const violations: Array<{
    geofence_id: string;
    name: string;
    zone_type: string;
    event_type: 'ENTRY' | 'EXIT';
  }> = [];

  for (const gf of geofences.rows) {
    const distance = haversineDistance(
      latitude, longitude,
      Number(gf.latitude), Number(gf.longitude)
    );
    const isInside = distance <= Number(gf.radius_meters);

    // Check last known state for this geofence+device
    const lastState = await query(
      `SELECT event_type FROM geofence_events
       WHERE geofence_id = $1 AND device_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [gf.id, deviceId]
    );
    const lastEvent = lastState.rows[0]?.event_type;

    if (isInside && lastEvent !== 'ENTRY' && gf.alert_on_entry) {
      violations.push({
        geofence_id: gf.id,
        name: gf.name,
        zone_type: gf.zone_type,
        event_type: 'ENTRY',
      });
      // Record the event
      await query(
        `INSERT INTO geofence_events (geofence_id, device_id, child_id, event_type, latitude, longitude)
         VALUES ($1, $2, $3, 'ENTRY', $4, $5)`,
        [gf.id, deviceId, childId, latitude, longitude]
      );
    } else if (!isInside && lastEvent === 'ENTRY' && gf.alert_on_exit) {
      violations.push({
        geofence_id: gf.id,
        name: gf.name,
        zone_type: gf.zone_type,
        event_type: 'EXIT',
      });
      await query(
        `INSERT INTO geofence_events (geofence_id, device_id, child_id, event_type, latitude, longitude)
         VALUES ($1, $2, $3, 'EXIT', $4, $5)`,
        [gf.id, deviceId, childId, latitude, longitude]
      );
    }
  }

  return violations;
};

/**
 * Haversine formula: distance in meters between two lat/lng points.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
