// daily-location-summary.service.ts
// Aggregated location summaries per day for a child.

import { query } from '../../config/database';
import { verifyChildBelongsToParent } from '../children/children.service';
import { toOffset, buildPaginationMeta } from '../../utils/pagination';

/**
 * Get daily location summary for a child on a specific date.
 * Aggregates location pings: total pings, time span, visited locations, etc.
 */
export const getDailySummary = async (
  parentId: string,
  childId: string,
  date: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT
       $2::date AS date,
       COUNT(*)::int AS total_pings,
       MIN(ll.recorded_at) AS first_ping,
       MAX(ll.recorded_at) AS last_ping,
       EXTRACT(EPOCH FROM (MAX(ll.recorded_at) - MIN(ll.recorded_at)))::int AS span_seconds,
       COUNT(DISTINCT ll.device_id)::int AS device_count,
       ROUND(AVG(ll.latitude)::numeric, 6) AS avg_latitude,
       ROUND(AVG(ll.longitude)::numeric, 6) AS avg_longitude,
       ROUND(AVG(ll.accuracy_m)::numeric, 1) AS avg_accuracy_m
     FROM location_logs ll
     JOIN devices d ON d.id = ll.device_id
     WHERE d.child_id = $1
       AND ll.recorded_at::date = $2::date`,
    [childId, date]
  );

  // Get unique approximate locations (cluster nearby pings)
  const locations = await query(
    `SELECT
       ROUND(ll.latitude::numeric, 4) AS lat_cluster,
       ROUND(ll.longitude::numeric, 4) AS lng_cluster,
       COUNT(*)::int AS ping_count,
       MIN(ll.recorded_at) AS arrived_at,
       MAX(ll.recorded_at) AS left_at
     FROM location_logs ll
     JOIN devices d ON d.id = ll.device_id
     WHERE d.child_id = $1
       AND ll.recorded_at::date = $2::date
     GROUP BY lat_cluster, lng_cluster
     ORDER BY ping_count DESC`,
    [childId, date]
  );

  return {
    date,
    summary: result.rows[0] || {
      date,
      total_pings: 0,
      first_ping: null,
      last_ping: null,
      span_seconds: 0,
      device_count: 0,
      avg_latitude: null,
      avg_longitude: null,
      avg_accuracy_m: null,
    },
    locations: locations.rows,
  };
};

/**
 * Get daily location summaries for a child over a date range.
 */
export const getDailySummaryList = async (
  parentId: string,
  childId: string,
  startDate: string,
  endDate: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `SELECT
       ll.recorded_at::date AS date,
       COUNT(*)::int AS total_pings,
       MIN(ll.recorded_at) AS first_ping,
       MAX(ll.recorded_at) AS last_ping,
       EXTRACT(EPOCH FROM (MAX(ll.recorded_at) - MIN(ll.recorded_at)))::int AS span_seconds,
       COUNT(DISTINCT ll.device_id)::int AS device_count,
       ROUND(AVG(ll.latitude)::numeric, 6) AS avg_latitude,
       ROUND(AVG(ll.longitude)::numeric, 6) AS avg_longitude
     FROM location_logs ll
     JOIN devices d ON d.id = ll.device_id
     WHERE d.child_id = $1
       AND ll.recorded_at::date BETWEEN $2::date AND $3::date
     GROUP BY ll.recorded_at::date
     ORDER BY ll.recorded_at::date ASC`,
    [childId, startDate, endDate]
  );

  return {
    child_id: childId,
    start_date: startDate,
    end_date: endDate,
    summaries: result.rows,
  };
};
