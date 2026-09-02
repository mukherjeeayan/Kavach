// audit.service.ts
// Single write path for the audit_logs table (DPDP / security skill
// requirement: every write to child data tables is audited).
// Feature services call writeAuditLog instead of inlining the INSERT.
//
// Every entry is linked to the previous one via a SHA-256 hash chain,
// making the audit trail immutable: any retroactive modification of a
// single entry invalidates the chain from that point forward.

import crypto from 'crypto';
import { query } from '../../config/database';
import logger from '../../utils/logger';

export interface AuditEntry {
  actorId: string;
  targetChildId: string | null;
  action: string;
  resourceType: string;
  details?: Record<string, unknown> | string;
}

/**
 * Compute SHA-256 hash of a canonical JSON payload.
 */
function computeHash(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Append an audit entry into the cryptographic hash chain.
 * Fetches the last sequence number and hash for the actor's scope,
 * then links the new entry to the previous one.
 *
 * If the hash chain columns are not yet populated (migration pending),
 * falls back to a simple INSERT without hashing for backward compatibility.
 */
export const writeAuditLog = async ({
  actorId,
  targetChildId,
  action,
  resourceType,
  details,
}: AuditEntry): Promise<void> => {
  try {
    // Fetch the last sequence number and hash for this actor's scope
    const lastRecord = await query(
      `SELECT sequence_number, current_hash
       FROM audit_logs
       WHERE actor_id = $1 AND sequence_number IS NOT NULL
       ORDER BY sequence_number DESC
       LIMIT 1`,
      [actorId]
    );

    const lastRow = lastRecord.rows[0];
    const previousHash = lastRow?.current_hash ?? '0'.repeat(64);
    const sequenceNumber = lastRow
      ? (lastRow.sequence_number as number) + 1
      : 1;

    const timestamp = new Date().toISOString();

    // Canonical payload for hashing (deterministic key ordering)
    const hashPayload: Record<string, unknown> = {
      sequenceNumber,
      actorId,
      targetChildId,
      action,
      resourceType,
      details: details ?? {},
      timestamp,
      previousHash,
    };

    const currentHash = computeHash(hashPayload);

    await query(
      `INSERT INTO audit_logs
       (actor_id, target_child_id, action, resource_type, details,
        sequence_number, previous_hash, current_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actorId,
        targetChildId,
        action,
        resourceType,
        JSON.stringify(details ?? {}),
        sequenceNumber,
        previousHash,
        currentHash,
      ]
    );
  } catch (err) {
    // If hash chain columns don't exist yet (pre-migration), fall back
    // to a plain INSERT so existing deployments don't break.
    logger.warn(`Audit hash chain write failed, falling back to plain INSERT: ${err}`);
    await query(
      `INSERT INTO audit_logs (actor_id, target_child_id, action, resource_type, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        actorId,
        targetChildId,
        action,
        resourceType,
        JSON.stringify(details ?? {}),
      ]
    );
  }
};

/**
 * Verify the integrity of the audit hash chain for a given actor scope.
 * Returns the number of valid entries and the first broken sequence
 * number (if any).
 */
export const verifyAuditChain = async (
  actorId: string
): Promise<{ valid: number; brokenAt: number | null; total: number }> => {
  const result = await query(
    `SELECT sequence_number, actor_id, target_child_id, action,
            resource_type, details, created_at, previous_hash, current_hash
     FROM audit_logs
     WHERE actor_id = $1 AND sequence_number IS NOT NULL
     ORDER BY sequence_number ASC`,
    [actorId]
  );

  const entries = result.rows;
  if (entries.length === 0) {
    return { valid: 0, brokenAt: null, total: 0 };
  }

  let validCount = 0;
  let expectedPrevious = '0'.repeat(64);

  for (const entry of entries) {
    // Verify the previous_hash links to the expected chain position
    if (entry.previous_hash !== expectedPrevious) {
      return {
        valid: validCount,
        brokenAt: entry.sequence_number as number,
        total: entries.length,
      };
    }

    // Recompute the hash and compare
    const hashPayload: Record<string, unknown> = {
      sequenceNumber: entry.sequence_number,
      actorId: entry.actor_id,
      targetChildId: entry.target_child_id,
      action: entry.action,
      resourceType: entry.resource_type,
      details: typeof entry.details === 'string'
        ? JSON.parse(entry.details)
        : entry.details,
      timestamp: entry.created_at,
      previousHash: entry.previous_hash,
    };

    const recomputedHash = computeHash(hashPayload);
    if (recomputedHash !== entry.current_hash) {
      return {
        valid: validCount,
        brokenAt: entry.sequence_number as number,
        total: entries.length,
      };
    }

    expectedPrevious = entry.current_hash;
    validCount++;
  }

  return { valid: validCount, brokenAt: null, total: entries.length };
};
