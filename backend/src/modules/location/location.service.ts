// location.service.ts
// GPS pings from the child device and read-back for the parent
// dashboard (current position per device + history).

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  speed_kmh?: number;
  recorded_at?: string;
}

export const recordLocation = async (
  parentId: string,
  deviceId: string,
  point: LocationPoint
): Promise<void> => {
  const device = await query(
    `SELECT d.id, d.child_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) {
    throw new NotFoundError('Device not found for this parent');
  }

  await query(
    `INSERT INTO location_logs (device_id, latitude, longitude, accuracy_m, speed_kmh, recorded_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))`,
    [
      deviceId,
      point.latitude,
      point.longitude,
      point.accuracy_m ?? null,
      point.speed_kmh ?? null,
      point.recorded_at ?? null,
    ]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: device.rows[0].child_id,
    action: 'LOCATION_PING',
    resourceType: 'location_logs',
    details: { device_id: deviceId },
  });
};

/**
 * Latest recorded position per device of the child.
 */
export const getCurrentLocations = async (
  parentId: string,
  childId: string
): Promise<Array<Record<string, unknown>>> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `SELECT DISTINCT ON (device_id) device_id, latitude, longitude,
            accuracy_m, speed_kmh, recorded_at
     FROM location_logs
     WHERE device_id IN (SELECT id FROM devices WHERE child_id = $1)
     ORDER BY device_id, recorded_at DESC`,
    [childId]
  );
  return result.rows;
};

export const getLocationHistory = async (
  parentId: string,
  childId: string,
  from?: string,
  to?: string,
  limit = 100
): Promise<Array<Record<string, unknown>>> => {
  await verifyChildBelongsToParent(childId, parentId);

  const params: unknown[] = [childId, limit];
  let timeFilter = '';
  if (from) {
    params.push(from);
    timeFilter += ` AND recorded_at >= $${params.length}::timestamptz`;
  }
  if (to) {
    params.push(to);
    timeFilter += ` AND recorded_at <= $${params.length}::timestamptz`;
  }

  const result = await query(
    `SELECT device_id, latitude, longitude, accuracy_m, speed_kmh, recorded_at
     FROM location_logs
     WHERE device_id IN (SELECT id FROM devices WHERE child_id = $1)
     ${timeFilter}
     ORDER BY recorded_at DESC
     LIMIT $2`,
    params
  );
  return result.rows;
};
