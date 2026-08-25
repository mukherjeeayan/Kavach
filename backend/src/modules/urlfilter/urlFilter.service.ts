// urlFilter.service.ts
// CRUD + lookup for per-child URL allow/block rules.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset, buildPaginationMeta } from '../../utils/pagination';

export interface UrlFilterRuleInput {
  url_pattern: string;
  rule_type: 'ALLOW' | 'BLOCK';
  category?: string;
  is_active?: boolean;
}

/**
 * List all URL filter rules for a child (paginated).
 */
export const listRules = async (
  parentId: string,
  childId: string,
  page: number,
  limit: number
) => {
  await verifyChildBelongsToParent(childId, parentId);
  const limitNum = Number(limit) || 50;
  const pageNum = Number(page) || 1;
  const offset = toOffset(pageNum, limitNum);

  const [items, countResult] = await Promise.all([
    query(
      `SELECT * FROM url_filter_rules
       WHERE child_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [childId, limitNum, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM url_filter_rules WHERE child_id = $1`,
      [childId]
    ),
  ]);

  const total = countResult.rows[0].total;
  return {
    data: items.rows,
    meta: buildPaginationMeta(pageNum, limitNum, total)
  };
};

/**
 * Create a new URL filter rule.
 */
export const createRule = async (
  parentId: string,
  childId: string,
  input: UrlFilterRuleInput
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `INSERT INTO url_filter_rules (child_id, url_pattern, rule_type, category, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [childId, input.url_pattern, input.rule_type, input.category || null, input.is_active ?? true]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CREATE_URL_FILTER',
    resourceType: 'url_filter_rules',
    details: { rule_id: result.rows[0].id, url_pattern: input.url_pattern, rule_type: input.rule_type },
  });

  return result.rows[0];
};

/**
 * Update an existing URL filter rule.
 */
export const updateRule = async (
  parentId: string,
  childId: string,
  ruleId: string,
  input: Partial<UrlFilterRuleInput>
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const existing = await query(
    `SELECT id FROM url_filter_rules WHERE id = $1 AND child_id = $2`,
    [ruleId, childId]
  );
  if (existing.rows.length === 0) throw new NotFoundError('URL filter rule not found');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.url_pattern !== undefined) { sets.push(`url_pattern = $${idx++}`); params.push(input.url_pattern); }
  if (input.rule_type !== undefined)   { sets.push(`rule_type = $${idx++}`);   params.push(input.rule_type);   }
  if (input.category !== undefined)    { sets.push(`category = $${idx++}`);    params.push(input.category);    }
  if (input.is_active !== undefined)   { sets.push(`is_active = $${idx++}`);   params.push(input.is_active);   }

  if (sets.length === 0) {
    const current = await query(`SELECT * FROM url_filter_rules WHERE id = $1`, [ruleId]);
    return current.rows[0];
  }

  params.push(ruleId);
  const result = await query(
    `UPDATE url_filter_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'UPDATE_URL_FILTER',
    resourceType: 'url_filter_rules',
    details: { rule_id: ruleId, changes: input },
  });

  return result.rows[0];
};

/**
 * Delete a URL filter rule.
 */
export const deleteRule = async (
  parentId: string,
  childId: string,
  ruleId: string
) => {
  await verifyChildBelongsToParent(childId, parentId);

  const result = await query(
    `DELETE FROM url_filter_rules WHERE id = $1 AND child_id = $2 RETURNING id`,
    [ruleId, childId]
  );
  if (result.rows.length === 0) throw new NotFoundError('URL filter rule not found');

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'DELETE_URL_FILTER',
    resourceType: 'url_filter_rules',
    details: { rule_id: ruleId },
  });
};

/**
 * Get all active rules for a child (used by the device to sync rules).
 */
export const getActiveRulesForChild = async (childId: string) => {
  const result = await query(
    `SELECT url_pattern, rule_type, category FROM url_filter_rules
     WHERE child_id = $1 AND is_active = TRUE
     ORDER BY rule_type ASC, url_pattern ASC`,
    [childId]
  );
  return result.rows;
};
