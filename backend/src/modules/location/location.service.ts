// location.service.ts
// GPS pings from the child device and read-back for the parent
// dashboard (current position per device + history).
//
// Ingestion pipeline:
// 1. Ping arrives via REST endpoint
// 2. Write to Redis Stream (async, non-blocking)
// 3. Update Redis geospatial index (O(1) real-time reads)
// 4. Background worker batch-inserts into PostgreSQL
//
// Read path:
// 1. Try Redis geospatial index for real-time position (sub-ms)
// 2. Fall back to PostgreSQL if Redis unavailable

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import {
  ingestTelemetryPing,
  getCurrentLocationFromRedis,
} from './telemetryBuffer';
import { getRedisClient } from '../../config/redis';
import logger from '../../utils/logger';

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
    `SELECT d.id, d.child_id, c.id AS cid, c.parent_id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND (c.parent_id = $2 OR EXISTS (
       SELECT 1 FROM child_guardians g WHERE g.child_id = c.id AND g.parent_id = $2
     ))`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) {
    throw new NotFoundError('Device not found for this parent');
  }

  const childId = device.rows[0].child_id;

  // Discard inaccurate pings at the API layer (accuracy > 50m)
  // to prevent geofence jitter from bad GPS readings.
  if (point.accuracy_m && point.accuracy_m > 50) {
    return;
  }

  const timestamp = point.recorded_at
    ? new Date(point.recorded_at).getTime()
    : Date.now();

  // Try Redis Stream pipeline first (async, non-blocking)
  const redisAccepted = await ingestTelemetryPing({
    childId,
    familyId: parentId,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy: point.accuracy_m ?? 0,
    speedKmh: point.speed_kmh,
    timestamp,
  });

  // Fall back to direct PostgreSQL write if Redis is unavailable
  if (!redisAccepted) {
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
  }

  // Audit log (lightweight — no blocking on Redis)
  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'LOCATION_PING',
    resourceType: 'location_logs',
    details: { device_id: deviceId, buffered: redisAccepted },
  });
};

/**
 * Latest recorded position per device of the child.
 * Tries Redis geospatial index first (sub-ms), falls back to PostgreSQL.
 */
export const getCurrentLocations = async (
  parentId: string,
  childId: string
): Promise<Array<Record<string, unknown>>> => {
  await verifyChildBelongsToParent(childId, parentId);

  // Try Redis first for real-time position
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      const geoKey = `family:live_geo:${parentId}`;
      const positions = await redis.geopos(geoKey, childId);
      if (positions && positions.length > 0 && positions[0]) {
        const [lon, lat] = positions[0] as unknown as [number, number];
        // Get the latest device info for context
        const deviceResult = await query(
          `SELECT id AS device_id FROM devices WHERE child_id = $1 LIMIT 1`,
          [childId]
        );
        if (deviceResult.rows.length > 0) {
          return [
            {
              device_id: deviceResult.rows[0].device_id,
              latitude: lat,
              longitude: lon,
              accuracy_m: null,
              speed_kmh: null,
              recorded_at: new Date().toISOString(),
              source: 'redis',
            },
          ];
        }
      }
    } catch (err) {
      logger.warn(`Redis geo read failed, falling back to PG: ${err}`);
    }
  }

  // Fall back to PostgreSQL
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
