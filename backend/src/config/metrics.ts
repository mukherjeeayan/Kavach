// metrics.ts
// Prometheus metrics collection and endpoint for backend observability.
// Exposes /metrics endpoint for Prometheus scraping.

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a registry to hold all metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, event loop, GC, etc.)
collectDefaultMetrics({ register });

// ── HTTP Request Metrics ──────────────────────────────────────────────

export const httpRequestDuration = new Histogram({
  name: 'kavach_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'kavach_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ── Authentication Metrics ────────────────────────────────────────────

export const authLoginAttempts = new Counter({
  name: 'kavach_auth_login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['method', 'success'],
  registers: [register],
});

export const authRefreshTokenRequests = new Counter({
  name: 'kavach_auth_refresh_token_requests_total',
  help: 'Total number of refresh token requests',
  labelNames: ['success'],
  registers: [register],
});

// ── Business Logic Metrics ────────────────────────────────────────────

export const telemetryIngested = new Counter({
  name: 'kavach_telemetry_ingested_total',
  help: 'Total number of telemetry pings ingested',
  labelNames: ['type'],
  registers: [register],
});

export const geofenceAlerts = new Counter({
  name: 'kavach_geofence_alerts_total',
  help: 'Total number of geofence alerts triggered',
  labelNames: ['event_type'],
  registers: [register],
});

export const sosAlertsTriggered = new Counter({
  name: 'kavach_sos_alerts_triggered_total',
  help: 'Total number of SOS alerts triggered',
  registers: [register],
});

export const pushNotificationsSent = new Counter({
  name: 'kavach_push_notifications_sent_total',
  help: 'Total number of push notifications sent',
  labelNames: ['channel', 'priority'],
  registers: [register],
});

// ── Database Metrics ──────────────────────────────────────────────────

export const dbQueryDuration = new Histogram({
  name: 'kavach_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const dbConnectionsActive = new Gauge({
  name: 'kavach_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// ── Redis Metrics ─────────────────────────────────────────────────────

export const redisOperationsTotal = new Counter({
  name: 'kavach_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation'],
  registers: [register],
});

// ── WebSocket Metrics ─────────────────────────────────────────────────

export const websocketConnectionsActive = new Gauge({
  name: 'kavach_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// ── Content Moderation Metrics ────────────────────────────────────────

export const contentScanDuration = new Histogram({
  name: 'kavach_content_scan_duration_seconds',
  help: 'Duration of content scanning operations',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

export const contentScanMatches = new Counter({
  name: 'kavach_content_scan_matches_total',
  help: 'Total number of content scan matches',
  registers: [register],
});

// ── Audit Log Metrics ─────────────────────────────────────────────────

export const auditLogEntries = new Counter({
  name: 'kavach_audit_log_entries_total',
  help: 'Total number of audit log entries created',
  labelNames: ['action'],
  registers: [register],
});

// ── Partition Maintenance Metrics ─────────────────────────────────────

export const partitionMaintenanceRuns = new Counter({
  name: 'kavach_partition_maintenance_runs_total',
  help: 'Total number of partition maintenance runs',
  labelNames: ['success'],
  registers: [register],
});

export const partitionsDropped = new Counter({
  name: 'kavach_partitions_dropped_total',
  help: 'Total number of partitions dropped',
  registers: [register],
});
