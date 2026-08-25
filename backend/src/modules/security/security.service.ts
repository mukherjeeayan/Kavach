// security.service.ts
// Security scan recording and WiFi monitoring.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

export interface SecurityScanInput {
  scan_type: 'ROOT' | 'KEYLOGGER' | 'WIFI' | 'APP_INTEGRITY' | 'FULL';
  result: Record<string, unknown>;
  threats_found?: number;
}

export interface WifiLogInput {
  ssid?: string;
  bssid?: string;
  security_type?: string;
  is_open?: boolean;
  is_known?: boolean;
  ip_address?: string;
}

const SCAN_COLUMNS =
  'id, device_id, scan_type, result, threats_found, scanned_at';
const WIFI_COLUMNS =
  'id, device_id, ssid, bssid, security_type, is_open, is_known, ip_address, recorded_at';

// ─── Device-side: record security scan ──────────────────────────

export const recordSecurityScan = async (
  parentId: string,
  deviceId: string,
  input: SecurityScanInput
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
    `INSERT INTO security_scans (device_id, scan_type, result, threats_found)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SCAN_COLUMNS}`,
    [
      deviceId,
      input.scan_type,
      JSON.stringify(input.result),
      input.threats_found ?? 0,
    ]
  );

  // Alert if threats found
  if ((input.threats_found ?? 0) > 0) {
    await writeAuditLog({
      actorId: parentId,
      targetChildId: childId,
      action: 'SECURITY_THREAT_DETECTED',
      resourceType: 'security_scans',
      details: {
        scan_id: result.rows[0].id,
        scan_type: input.scan_type,
        threats_found: input.threats_found,
      },
    });
  }

  return result.rows[0];
};

// ─── Device-side: record WiFi connection ────────────────────────

export const recordWifiLog = async (
  parentId: string,
  deviceId: string,
  input: WifiLogInput
) => {
  const device = await query(
    `SELECT d.id FROM devices d
     JOIN children c ON c.id = d.child_id
     WHERE d.id = $1 AND c.parent_id = $2`,
    [deviceId, parentId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this parent');

  const result = await query(
    `INSERT INTO wifi_logs (device_id, ssid, bssid, security_type, is_open, is_known, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${WIFI_COLUMNS}`,
    [
      deviceId,
      input.ssid ?? null,
      input.bssid ?? null,
      input.security_type ?? null,
      input.is_open ?? false,
      input.is_known ?? true,
      input.ip_address ?? null,
    ]
  );

  return result.rows[0];
};

// ─── Parent-side: list security scans ───────────────────────────

export const listSecurityScans = async (
  parentId: string,
  childId: string,
  deviceId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  // Verify device belongs to child
  const device = await query(
    `SELECT id FROM devices WHERE id = $1 AND child_id = $2`,
    [deviceId, childId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this child');

  const count = await query(
    `SELECT COUNT(*)::int AS total FROM security_scans WHERE device_id = $1`,
    [deviceId]
  );

  const result = await query(
    `SELECT ${SCAN_COLUMNS}
     FROM security_scans
     WHERE device_id = $1
     ORDER BY scanned_at DESC
     LIMIT $2 OFFSET $3`,
    [deviceId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};

// ─── Parent-side: list WiFi logs ────────────────────────────────

export const listWifiLogs = async (
  parentId: string,
  childId: string,
  deviceId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  // Verify device belongs to child
  const device = await query(
    `SELECT id FROM devices WHERE id = $1 AND child_id = $2`,
    [deviceId, childId]
  );
  if (device.rows.length === 0) throw new NotFoundError('Device not found for this child');

  const count = await query(
    `SELECT COUNT(*)::int AS total FROM wifi_logs WHERE device_id = $1`,
    [deviceId]
  );

  const result = await query(
    `SELECT ${WIFI_COLUMNS}
     FROM wifi_logs
     WHERE device_id = $1
     ORDER BY recorded_at DESC
     LIMIT $2 OFFSET $3`,
    [deviceId, limit, toOffset(page, limit)]
  );

  return { items: result.rows, total: count.rows[0].total };
};
