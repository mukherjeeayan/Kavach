// keywordDict.service.ts
// CRUD for the keyword dictionary used by communication flagging.

import { query } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset, buildPaginationMeta } from '../../utils/pagination';
import type { CreateKeywordInput, UpdateKeywordInput, BulkCreateKeywordsInput } from './keywordDict.dto';

/**
 * List all keyword dictionary entries (admin, paginated).
 */
export const listKeywords = async (
  page: number,
  limit: number,
  category?: string,
  activeOnly: boolean = false
) => {
  const limitNum = Number(limit) || 50;
  const pageNum = Number(page) || 1;
  const offset = toOffset(pageNum, limitNum);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (category) {
    conditions.push(`category = $${idx++}`);
    params.push(category);
  }
  if (activeOnly) {
    conditions.push(`is_active = TRUE`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [items, countResult] = await Promise.all([
    query(
      `SELECT * FROM keyword_dictionaries ${whereClause}
       ORDER BY category ASC, keyword ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limitNum, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM keyword_dictionaries ${whereClause}`,
      params
    ),
  ]);

  return {
    data: items.rows,
    meta: buildPaginationMeta(pageNum, limitNum, countResult.rows[0].total),
  };
};

/**
 * Create a single keyword entry.
 */
export const createKeyword = async (input: CreateKeywordInput) => {
  const existing = await query(
    `SELECT id FROM keyword_dictionaries
     WHERE category = $1 AND keyword = $2 AND language = $3`,
    [input.category, input.keyword.toLowerCase(), input.language]
  );
  if (existing.rows.length > 0) {
    throw new ConflictError('Keyword already exists in this category/language');
  }

  const result = await query(
    `INSERT INTO keyword_dictionaries (category, keyword, severity, language, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.category, input.keyword.toLowerCase(), input.severity ?? 'MEDIUM', input.language ?? 'en', input.is_active ?? true]
  );

  await writeAuditLog({
    actorId: 'system',
    targetChildId: null,
    action: 'CREATE_KEYWORD',
    resourceType: 'keyword_dictionaries',
    details: { keyword_id: result.rows[0].id, category: input.category, keyword: input.keyword },
  });

  return result.rows[0];
};

/**
 * Bulk create keyword entries (skip duplicates).
 */
export const bulkCreateKeywords = async (input: BulkCreateKeywordsInput) => {
  let created = 0;
  let skipped = 0;

  for (const kw of input.keywords) {
    try {
      await query(
        `INSERT INTO keyword_dictionaries (category, keyword, severity, language, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (category, keyword, language) DO NOTHING`,
        [kw.category, kw.keyword.toLowerCase(), kw.severity ?? 'MEDIUM', kw.language ?? 'en']
      );
      created++;
    } catch {
      skipped++;
    }
  }

  return { created, skipped, total: input.keywords.length };
};

/**
 * Update a keyword entry.
 */
export const updateKeyword = async (
  keywordId: string,
  input: UpdateKeywordInput
) => {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.severity !== undefined) { sets.push(`severity = $${idx++}`); params.push(input.severity); }
  if (input.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(input.is_active); }

  if (sets.length === 0) {
    const current = await query(`SELECT * FROM keyword_dictionaries WHERE id = $1`, [keywordId]);
    if (current.rows.length === 0) throw new NotFoundError('Keyword not found');
    return current.rows[0];
  }

  params.push(keywordId);
  const result = await query(
    `UPDATE keyword_dictionaries SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Keyword not found');

  return result.rows[0];
};

/**
 * Delete a keyword entry.
 */
export const deleteKeyword = async (keywordId: string) => {
  const result = await query(
    `DELETE FROM keyword_dictionaries WHERE id = $1 RETURNING id`,
    [keywordId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Keyword not found');
};
