// admin.service.ts
// Business logic for the admin panel — user management, feature flags,
// and subscription overrides. All mutating actions are audit-logged.

import { query } from '../../config/database';
import { writeAuditLog } from '../shared/audit.service';
import { NotFoundError, BadRequestError } from '../../utils/errors';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
  trial_expires_at: string | null;
  subscription_updated_at: string | null;
  created_at: string;
  child_count: number;
  payment_count: number;
}

export interface FeatureFlagRow {
  id: string;
  key: string;
  description: string | null;
  is_enabled: boolean;
  required_tier: string;
  updated_at: string;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const listUsers = async (
  page = 1,
  limit = 20,
  search?: string
): Promise<{ users: AdminUserRow[]; total: number }> => {
  const offset = (page - 1) * limit;

  const where = search
    ? `WHERE (p.email ILIKE $3 OR p.name ILIKE $3)`
    : '';
  const params: (string | number)[] = [limit, offset];
  if (search) params.push(`%${search}%`);

  const [rows, countRow] = await Promise.all([
    query(
      `SELECT
         p.id, p.email, p.name, p.role,
         p.subscription_tier, p.trial_expires_at, p.subscription_updated_at, p.created_at,
         COUNT(DISTINCT c.id)::int  AS child_count,
         COUNT(DISTINCT sp.id)::int AS payment_count
       FROM parents p
       LEFT JOIN children c ON c.parent_id = p.id
       LEFT JOIN subscription_payments sp ON sp.parent_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM parents p ${where}`,
      search ? [`%${search}%`] : []
    ),
  ]);

  return { users: rows.rows as AdminUserRow[], total: countRow.rows[0].total };
};

export const getUserById = async (userId: string): Promise<AdminUserRow> => {
  const result = await query(
    `SELECT
       p.id, p.email, p.name, p.role,
       p.subscription_tier, p.trial_expires_at, p.subscription_updated_at, p.created_at,
       COUNT(DISTINCT c.id)::int  AS child_count,
       COUNT(DISTINCT sp.id)::int AS payment_count
     FROM parents p
     LEFT JOIN children c ON c.parent_id = p.id
     LEFT JOIN subscription_payments sp ON sp.parent_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [userId]
  );
  if (!result.rows.length) throw new NotFoundError('User not found');
  return result.rows[0] as AdminUserRow;
};

export const updateUserSubscription = async (
  adminId: string,
  userId: string,
  tier: string,
  trialDays?: number
): Promise<AdminUserRow> => {
  const validTiers = ['FREE', 'TRIAL', 'PREMIUM'];
  if (!validTiers.includes(tier.toUpperCase())) {
    throw new BadRequestError(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
  }

  const upperTier = tier.toUpperCase();
  const trialExpiresAt =
    upperTier === 'TRIAL'
      ? new Date(Date.now() + (trialDays ?? 7) * 86_400_000).toISOString()
      : null;

  await query(
    `UPDATE parents
     SET subscription_tier       = $1,
         trial_expires_at        = $2,
         subscription_updated_at = now()
     WHERE id = $3`,
    [upperTier, trialExpiresAt, userId]
  );

  await writeAuditLog({
    actorId: adminId,
    targetChildId: null,
    action: 'ADMIN_UPDATE_SUBSCRIPTION',
    resourceType: 'parents',
    details: { target_user: userId, tier: upperTier, trial_expires_at: trialExpiresAt },
  });

  return getUserById(userId);
};

export const updateUserRole = async (
  adminId: string,
  userId: string,
  role: string
): Promise<AdminUserRow> => {
  const validRoles = ['parent', 'admin'];
  if (!validRoles.includes(role.toLowerCase())) {
    throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  if (adminId === userId) {
    throw new BadRequestError('Admins cannot change their own role');
  }

  await query(
    `UPDATE parents SET role = $1 WHERE id = $2`,
    [role.toLowerCase(), userId]
  );

  await writeAuditLog({
    actorId: adminId,
    targetChildId: null,
    action: 'ADMIN_UPDATE_ROLE',
    resourceType: 'parents',
    details: { target_user: userId, role },
  });

  return getUserById(userId);
};

// ─── Feature Flags ─────────────────────────────────────────────────────────────

export const listFeatureFlags = async (): Promise<FeatureFlagRow[]> => {
  const result = await query(
    `SELECT id, key, description, is_enabled, required_tier, updated_at
     FROM feature_flags ORDER BY key ASC`
  );
  return result.rows as FeatureFlagRow[];
};

export const updateFeatureFlag = async (
  adminId: string,
  key: string,
  patch: { is_enabled?: boolean; required_tier?: string }
): Promise<FeatureFlagRow> => {
  const { is_enabled, required_tier } = patch;

  if (required_tier) {
    const validTiers = ['FREE', 'TRIAL', 'PREMIUM'];
    if (!validTiers.includes(required_tier.toUpperCase())) {
      throw new BadRequestError(`Invalid required_tier. Must be one of: ${validTiers.join(', ')}`);
    }
  }

  const result = await query(
    `UPDATE feature_flags
     SET is_enabled    = COALESCE($1, is_enabled),
         required_tier = COALESCE($2, required_tier)
     WHERE key = $3
     RETURNING id, key, description, is_enabled, required_tier, updated_at`,
    [
      is_enabled !== undefined ? is_enabled : null,
      required_tier ? required_tier.toUpperCase() : null,
      key,
    ]
  );

  if (!result.rows.length) throw new NotFoundError(`Feature flag '${key}' not found`);

  await writeAuditLog({
    actorId: adminId,
    targetChildId: null,
    action: 'ADMIN_UPDATE_FEATURE_FLAG',
    resourceType: 'feature_flags',
    details: { key, ...patch },
  });

  return result.rows[0] as FeatureFlagRow;
};

// ─── Stats ─────────────────────────────────────────────────────────────────────

export const getSystemStats = async () => {
  const result = await query(`
    SELECT
      COUNT(*)                                                   AS total_users,
      COUNT(*) FILTER (WHERE subscription_tier = 'FREE')        AS free_users,
      COUNT(*) FILTER (WHERE subscription_tier = 'TRIAL'
                         AND trial_expires_at > now())          AS active_trial_users,
      COUNT(*) FILTER (WHERE subscription_tier = 'TRIAL'
                         AND trial_expires_at <= now())         AS expired_trial_users,
      COUNT(*) FILTER (WHERE subscription_tier = 'PREMIUM')     AS premium_users,
      COUNT(*) FILTER (WHERE role = 'admin')                    AS admin_users,
      COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '7 days') AS new_users_7d,
      COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') AS new_users_30d
    FROM parents
  `);
  return result.rows[0];
};
