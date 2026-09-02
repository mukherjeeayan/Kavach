// children.service.ts
// Business logic for child profiles. Every operation verifies that
// the child belongs to the authenticated parent before touching data.

import { query } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { toOffset } from '../../utils/pagination';
import { writeAuditLog } from '../shared/audit.service';

export interface ChildProfile {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  daily_screen_time_limit_minutes: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Verify a child belongs to the given parent — either as the creating
 * owner (children.parent_id) or as a linked co-guardian
 * (child_guardians). Throws ForbiddenError otherwise. Used by every
 * child-scoped operation (app blocking, device registration, alerts, ...).
 */
export const verifyChildBelongsToParent = async (
  childId: string,
  parentId: string
): Promise<void> => {
  const result = await query(
    `SELECT 1 FROM children c
     WHERE c.id = $1
       AND ($2 = c.parent_id OR EXISTS (
         SELECT 1 FROM child_guardians g
         WHERE g.child_id = c.id AND g.parent_id = $2
       ))`,
    [childId, parentId]
  );
  if (result.rows.length === 0) {
    throw new ForbiddenError('Child does not belong to this parent');
  }
};

/**
 * True when the parent is the child's creating owner (not merely a
 * co-guardian). Only owners may share/unshare or delete the profile.
 */
export const isChildOwner = async (
  childId: string,
  parentId: string
): Promise<boolean> => {
  const result = await query(
    `SELECT 1 FROM children WHERE id = $1 AND parent_id = $2`,
    [childId, parentId]
  );
  return result.rows.length > 0;
};

// ── Co-guardian sharing ─────────────────────────────────────────────

export interface Guardian {
  parent_id: string;
  name: string;
  email: string;
  role: string;
}

/**
 * List all guardians (including the owner) of a child.
 */
export const listGuardians = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Guardian[]; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);
  const offset = (page - 1) * limit;

  const [itemsResult, countResult] = await Promise.all([
    query(
      `SELECT p.id AS parent_id, p.name, p.email, g.role
       FROM child_guardians g
       JOIN parents p ON p.id = g.parent_id
       WHERE g.child_id = $1
       ORDER BY g.created_at ASC
       LIMIT $2 OFFSET $3`,
      [childId, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM child_guardians
       WHERE child_id = $1`,
      [childId]
    ),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0].total,
  };
};

/**
 * Share a child with another parent account by email. Owner-only.
 * The guardian must already have an account; idempotent on re-invite.
 */
export const addGuardian = async (
  parentId: string,
  childId: string,
  guardianEmail: string
): Promise<Guardian> => {
  await verifyChildBelongsToParent(childId, parentId);
  if (!(await isChildOwner(childId, parentId))) {
    throw new ForbiddenError('Only the child owner can share access');
  }

  const guardian = await query(
    `SELECT id, name, email FROM parents WHERE email = $1`,
    [guardianEmail.toLowerCase().trim()]
  );
  if (guardian.rows.length === 0) {
    throw new NotFoundError('No account exists for that email');
  }
  const g = guardian.rows[0];
  if (g.id === parentId) {
    throw new ConflictError('The owner already has access');
  }

  await query(
    `INSERT INTO child_guardians (child_id, parent_id, role)
     VALUES ($1, $2, 'guardian')
     ON CONFLICT (child_id, parent_id) DO NOTHING`,
    [childId, g.id]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'ADD_GUARDIAN',
    resourceType: 'children',
    details: { guardian_id: g.id, guardian_email: g.email },
  });

  return { parent_id: g.id, name: g.name, email: g.email, role: 'guardian' };
};

/**
 * Revoke a guardian's access. Owner-only; the owner cannot be removed.
 */
export const removeGuardian = async (
  parentId: string,
  childId: string,
  guardianId: string
): Promise<void> => {
  await verifyChildBelongsToParent(childId, parentId);
  if (!(await isChildOwner(childId, parentId))) {
    throw new ForbiddenError('Only the child owner can revoke access');
  }
  if (guardianId === parentId) {
    throw new ConflictError('The owner cannot be removed');
  }

  const result = await query(
    `DELETE FROM child_guardians
     WHERE child_id = $1 AND parent_id = $2 AND role = 'guardian'`,
    [childId, guardianId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Guardian not found for this child');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'REMOVE_GUARDIAN',
    resourceType: 'children',
    details: { guardian_id: guardianId },
  });
};

/**
 * If a device_id is given, make sure it belongs to the child. Shared
 * by locks/contacts/app-blocking so a parent can never attach a rule
 * to another parent's device.
 */
export const ensureDeviceBelongsToChild = async (
  childId: string,
  deviceId?: string
): Promise<void> => {
  if (!deviceId) return;
  const result = await query(`SELECT id FROM devices WHERE id = $1 AND child_id = $2`, [
    deviceId,
    childId,
  ]);
  if (result.rows.length === 0) {
    throw new NotFoundError('Device not found for this child');
  }
};

/**
 * Verify a device belongs to a child the parent can access (owner or
 * co-guardian), and return the child's id. Used by device-scoped
 * ingestion routes where only :deviceId is in the URL.
 */
export const verifyParentCanAccessDevice = async (
  parentId: string,
  deviceId: string
): Promise<{ childId: string }> => {
  const device = await query(
    `SELECT child_id FROM devices WHERE id = $1`,
    [deviceId]
  );
  if (device.rows.length === 0) {
    throw new NotFoundError('Device not found');
  }
  const childId = device.rows[0].child_id as string;
  await verifyChildBelongsToParent(childId, parentId);
  return { childId };
};

/**
 * List all child profiles for a parent (ordered by creation time),
 * paginated.
 */
export const listChildren = async (
  parentId: string,
  page = 1,
  limit = 20
): Promise<{ items: ChildProfile[]; total: number }> => {
  const count = await query(`SELECT COUNT(*)::int AS total FROM children WHERE parent_id = $1`, [
    parentId,
  ]);
  const result = await query(
     `SELECT id, parent_id, name, birth_date, phone, daily_screen_time_limit_minutes, created_at, updated_at
      FROM children
      WHERE parent_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3`,
    [parentId, limit, toOffset(page, limit)]
  );
  return { items: result.rows, total: count.rows[0].total };
};

/**
 * Create a child profile for the authenticated parent.
 */
export const createChild = async (
  parentId: string,
  name: string,
  birthDate?: string
): Promise<ChildProfile> => {
  const result = await query(
     `INSERT INTO children (parent_id, name, birth_date)
      VALUES ($1, $2, $3)
      RETURNING id, parent_id, name, birth_date, phone, daily_screen_time_limit_minutes, created_at, updated_at`,
    [parentId, name.trim(), birthDate || null]
  );
  const child = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: child.id,
    action: 'CREATE_CHILD',
    resourceType: 'children',
    details: { name: child.name },
  });

  return child;
};

/**
 * Set (or clear, with null) the child's daily screen-time limit in
 * minutes. The Android device never needs to know the limit — the
 * backend evaluates it on every screen-time upload and raises an
 * alert when the day's total crosses it.
 */
export const setScreenTimeLimit = async (
  parentId: string,
  childId: string,
  limitMinutes: number | null
): Promise<ChildProfile> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
     `UPDATE children
      SET daily_screen_time_limit_minutes = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, parent_id, name, birth_date, phone, daily_screen_time_limit_minutes, created_at, updated_at`,
    [limitMinutes, childId]
  );
  const child = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SET_SCREEN_TIME_LIMIT',
    resourceType: 'children',
    details: { limit_minutes: limitMinutes },
  });

  return child;
};

export interface ChildAlert {
  id: string;
  action: string;
  resource_type: string;
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
}

/**
 * Recent security/limit alerts for a child (tamper reports from the
 * device, screen-time limit breaches) with acknowledgement state and
 * real offset pagination.
 */
export const listChildAlerts = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: ChildAlert[]; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);
  const cappedLimit = Math.min(limit, 100);
  const count = await query(
    `SELECT COUNT(*)::int AS total FROM audit_logs
     WHERE target_child_id = $1
       AND action IN ('TAMPER_ALERT', 'SCREEN_TIME_LIMIT_REACHED', 'PER_APP_LIMIT_REACHED', 'DEVICE_ADMIN_STATUS')`,
    [childId]
  );
  const result = await query(
    `SELECT id, action, resource_type, details, created_at, acknowledged_at
     FROM audit_logs
     WHERE target_child_id = $1
       AND action IN ('TAMPER_ALERT', 'SCREEN_TIME_LIMIT_REACHED', 'PER_APP_LIMIT_REACHED', 'DEVICE_ADMIN_STATUS')
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, cappedLimit, toOffset(page, cappedLimit)]
  );
  return { items: result.rows, total: count.rows[0].total };
};

/**
 * Mark alerts as seen/handled. When `alertIds` is omitted, ALL
 * unacknowledged alerts for the child are acknowledged.
 */
export const acknowledgeAlerts = async (
  parentId: string,
  childId: string,
  alertIds?: string[]
): Promise<{ acknowledged: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  if (alertIds && alertIds.length > 0) {
    const result = await query(
      `UPDATE audit_logs SET acknowledged_at = now()
       WHERE id = ANY($1::uuid[]) AND target_child_id = $2 AND acknowledged_at IS NULL`,
      [alertIds, childId]
    );
    return { acknowledged: result.rowCount ?? 0 };
  }

  const result = await query(
    `UPDATE audit_logs SET acknowledged_at = now()
     WHERE target_child_id = $1 AND acknowledged_at IS NULL
       AND action IN ('TAMPER_ALERT', 'SCREEN_TIME_LIMIT_REACHED', 'PER_APP_LIMIT_REACHED', 'DEVICE_ADMIN_STATUS')`,
    [childId]
  );
  return { acknowledged: result.rowCount ?? 0 };
};
/**
 * Fetch a single child profile the parent owns.
 */
export const getChild = async (
  parentId: string,
  childId: string
): Promise<ChildProfile> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
     `SELECT id, parent_id, name, birth_date, phone, daily_screen_time_limit_minutes, created_at, updated_at
      FROM children WHERE id = $1`,
    [childId]
  );
  return result.rows[0];
};

/**
 * Update a child profile (name and/or birth date). DPDP: parents can
 * correct their child's data.
 */
export const updateChild = async (
  parentId: string,
  childId: string,
  input: { name?: string; birth_date?: string }
): Promise<ChildProfile> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
     `UPDATE children
      SET name = COALESCE($3, name),
          birth_date = COALESCE($4, birth_date),
          updated_at = now()
      WHERE id = $1 AND parent_id = $2
      RETURNING id, parent_id, name, birth_date, phone, daily_screen_time_limit_minutes, created_at, updated_at`,
    [childId, parentId, input.name?.trim() ?? null, input.birth_date ?? null]
  );
  const child = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'UPDATE_CHILD',
    resourceType: 'children',
    details: { name: child.name },
  });

  return child;
};

/**
 * Delete a child profile. Cascades remove devices, rules, logs, and
 * consents for the child. DPDP erasure support.
 */
export const deleteChild = async (
  parentId: string,
  childId: string
): Promise<void> => {
  await verifyChildBelongsToParent(childId, parentId);

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'DELETE_CHILD',
    resourceType: 'children',
    details: { child_id: childId },
  });

  await query(`DELETE FROM children WHERE id = $1 AND parent_id = $2`, [childId, parentId]);
};

/**
 * Set or update the child's phone number.
 */
export const setChildPhone = async (
  parentId: string,
  childId: string,
  phone: string | null
): Promise<ChildProfile> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `UPDATE children
     SET phone = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, parent_id, name, birth_date, phone, daily_screen_time_limit_minutes, created_at, updated_at`,
    [phone, childId]
  );
  const child = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'SET_CHILD_PHONE',
    resourceType: 'children',
    details: { phone: phone ? '***' : null },
  });

  return child;
};

/**
 * Get the full offline policy snapshot for a child.
 * Aggregates schedules, app limits, geofences, and URL filters
 * into a single JSON object for offline sync.
 */
export const getOfflinePolicy = async (
  parentId: string,
  childId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const [schedulesResult, appLimitsResult, geofencesResult, urlFiltersResult] =
    await Promise.all([
      query(
        `SELECT id, name, start_time, end_time, days, action, allowed_packages
         FROM scheduled_locks
         WHERE child_id = $1 AND is_active = true
         ORDER BY created_at`,
        [childId]
      ),
      query(
        `SELECT id, package_name, daily_limit_minutes
         FROM app_block_rules
         WHERE child_id = $1 AND is_active = true
         ORDER BY created_at`,
        [childId]
      ),
      query(
        `SELECT id, name, latitude, longitude, radius_meters, alert_on_exit, alert_on_enter
         FROM geofences
         WHERE child_id = $1 AND is_active = true
         ORDER BY created_at`,
        [childId]
      ),
      query(
        `SELECT id, pattern, action
         FROM url_filters
         WHERE child_id = $1 AND is_active = true
         ORDER BY created_at`,
        [childId]
      ),
    ]);

  return {
    policy_version: Date.now(),
    schedules: schedulesResult.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      startTime: r.start_time,
      endTime: r.end_time,
      days: r.days,
      action: r.action,
      allowedPackages: r.allowed_packages,
    })),
    app_limits: appLimitsResult.rows.map((r: any) => ({
      id: r.id,
      packageName: r.package_name,
      dailyLimitMinutes: r.daily_limit_minutes,
    })),
    geofences: geofencesResult.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      radiusMeters: r.radius_meters,
      alertOnExit: r.alert_on_exit,
      alertOnEnter: r.alert_on_enter,
    })),
    url_filters: urlFiltersResult.rows.map((r: any) => ({
      id: r.id,
      pattern: r.pattern,
      action: r.action,
    })),
  };
};
