// audit.service.ts
// Single write path for the audit_logs table (DPDP / security skill
// requirement: every write to child data tables is audited).
// Feature services call writeAuditLog instead of inlining the INSERT.

import { query } from '../../config/database';

export interface AuditEntry {
  actorId: string;
  targetChildId: string | null;
  action: string;
  resourceType: string;
  details?: Record<string, unknown> | string;
}

export const writeAuditLog = async ({
  actorId,
  targetChildId,
  action,
  resourceType,
  details,
}: AuditEntry): Promise<void> => {
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
};