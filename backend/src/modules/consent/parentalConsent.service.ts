// parentalConsent.service.ts
// Business logic for DPDP Act parental consent tracking.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';

export interface ParentalConsent {
  id: string;
  parent_id: string;
  child_id: string;
  consent_type: string;
  granted_at: string;
  revoked_at: string | null;
  ip_address: string | null;
}

/**
 * Grant consent for a specific data type on a child's profile.
 */
export const grantConsent = async (
  parentId: string,
  childId: string,
  consentType: string,
  ipAddress?: string
): Promise<ParentalConsent> => {
  await verifyChildBelongsToParent(childId, parentId);

  // Check if an active consent already exists
  const existing = await query(
    `SELECT id FROM parental_consent
     WHERE parent_id = $1 AND child_id = $2 AND consent_type = $3 AND revoked_at IS NULL`,
    [parentId, childId, consentType]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0] as ParentalConsent;
  }

  // Revoke any previously revoked consent for this type and create a new one
  await query(
    `UPDATE parental_consent SET revoked_at = now()
     WHERE parent_id = $1 AND child_id = $2 AND consent_type = $3 AND revoked_at IS NULL`,
    [parentId, childId, consentType]
  );

  const result = await query(
    `INSERT INTO parental_consent (parent_id, child_id, consent_type, ip_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id, parent_id, child_id, consent_type, granted_at, revoked_at, ip_address`,
    [parentId, childId, consentType, ipAddress || null]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CONSENT_GRANTED',
    resourceType: 'parental_consent',
    details: { consent_type: consentType },
  });

  return result.rows[0];
};

/**
 * Revoke consent for a specific data type.
 */
export const revokeConsent = async (
  parentId: string,
  childId: string,
  consentType: string
): Promise<void> => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `UPDATE parental_consent SET revoked_at = now()
     WHERE parent_id = $1 AND child_id = $2 AND consent_type = $3 AND revoked_at IS NULL`,
    [parentId, childId, consentType]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('No active consent found for this type');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CONSENT_REVOKED',
    resourceType: 'parental_consent',
    details: { consent_type: consentType },
  });
};

/**
 * List all consents (active and revoked) for a child.
 */
export const listConsents = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: ParentalConsent[]; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);

  const offset = (page - 1) * limit;

  const [itemsResult, countResult] = await Promise.all([
    query(
      `SELECT id, parent_id, child_id, consent_type, granted_at, revoked_at, ip_address
       FROM parental_consent
       WHERE parent_id = $1 AND child_id = $2
       ORDER BY granted_at DESC
       LIMIT $3 OFFSET $4`,
      [parentId, childId, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM parental_consent
       WHERE parent_id = $1 AND child_id = $2`,
      [parentId, childId]
    ),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0].total,
  };
};

/**
 * Check if a specific consent is currently active.
 */
export const hasActiveConsent = async (
  childId: string,
  consentType: string
): Promise<boolean> => {
  const result = await query(
    `SELECT id FROM parental_consent
     WHERE child_id = $1 AND consent_type = $2 AND revoked_at IS NULL`,
    [childId, consentType]
  );
  return result.rows.length > 0;
};
