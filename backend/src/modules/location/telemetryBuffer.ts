// telemetryBuffer.ts
// Asynchronous telemetry ingestion pipeline using Redis Streams.
//
// GPS pings from child devices are written to a Redis Stream instead
// of being synchronously persisted to PostgreSQL. This decouples the
// ingestion path from database I/O, preventing connection pool
// exhaustion during high-frequency tracking (e.g., school dismissals).
//
// The stream also maintains a live geospatial index via GEOADD for
// O(1) real-time location reads.

import { getRedisClient } from '../../config/redis';
import logger from '../../utils/logger';

export interface LocationTelemetry {
  childId: string;
  familyId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speedKmh?: number;
  batteryLevel?: number;
  timestamp: number;
}

const STREAM_KEY = 'stream:telemetry:location';
const GEO_KEY_PREFIX = 'family:live_geo';
const MAX_STREAM_LENGTH = 100_000; // Cap stream at ~100K entries

/**
 * Ingest a location ping into the Redis pipeline.
 *
 * 1. Discards inaccurate pings (accuracy > 50m) to prevent geofence jitter
 * 2. Updates the in-memory geospatial index (O(1) execution)
 * 3. Pushes to the Redis Stream for asynchronous persistence
 *
 * Returns true if the ping was accepted, false if discarded.
 */
export async function ingestTelemetryPing(ping: LocationTelemetry): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') {
    // Redis unavailable — fall back to no-op (ping will be lost).
    // In production, the caller should also write directly to PG as fallback.
    logger.warn('Redis unavailable — telemetry ping dropped');
    return false;
  }

  // Discard inaccurate pings to prevent geofence jitter
  if (ping.accuracy > 50) {
    return false;
  }

  try {
    const geoKey = `${GEO_KEY_PREFIX}:${ping.familyId}`;

    // 1. Update in-memory spatial index (O(1) execution)
    // GEOADD updates the position if the member already exists
    await redis.geoadd(geoKey, ping.longitude, ping.latitude, ping.childId);

    // Set TTL on geo key (7 days) to auto-cleanup inactive families
    await redis.expire(geoKey, 7 * 24 * 60 * 60);

    // 2. Stream to asynchronous persistence pipeline
    await redis.xadd(
      STREAM_KEY,
      'MAXLEN',
      '~',
      String(MAX_STREAM_LENGTH),
      '*',
      'payload',
      JSON.stringify(ping)
    );

    return true;
  } catch (err) {
    logger.error(`Telemetry ingestion failed: ${err}`);
    return false;
  }
}

/**
 * Read the current location of a child from the Redis geospatial index.
 * Returns null if no position is cached (e.g., after Redis restart).
 */
export async function getCurrentLocationFromRedis(
  familyId: string,
  childId: string
): Promise<{ latitude: number; longitude: number } | null> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') return null;

  try {
    const geoKey = `${GEO_KEY_PREFIX}:${familyId}`;
    const positions = await redis.geopos(geoKey, childId);
    if (!positions || positions.length === 0 || !positions[0]) return null;

    const [lon, lat] = positions[0] as unknown as [number, number];
    return { latitude: lat, longitude: lon };
  } catch (err) {
    logger.error(`Redis geo read failed: ${err}`);
    return null;
  }
}

/**
 * Get all children's current locations for a family from Redis.
 */
export async function getFamilyLocationsFromRedis(
  familyId: string
): Promise<Array<{ childId: string; latitude: number; longitude: number }>> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') return [];

  try {
    const geoKey = `${GEO_KEY_PREFIX}:${familyId}`;
    const members = await redis.zrange(geoKey, 0, -1);
    if (members.length === 0) return [];

    const results: Array<{ childId: string; latitude: number; longitude: number }> = [];
    for (const member of members) {
      const positions = await redis.geopos(geoKey, member);
      if (positions && positions.length > 0 && positions[0]) {
        const [lon, lat] = positions[0] as unknown as [number, number];
        results.push({ childId: member, latitude: lat, longitude: lon });
      }
    }
    return results;
  } catch (err) {
    logger.error(`Redis family geo read failed: ${err}`);
    return [];
  }
}
