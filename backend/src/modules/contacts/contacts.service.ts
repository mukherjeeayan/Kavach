// contacts.service.ts
// Allow/block rules for phone numbers. One rule per (child, number);
// re-adding an existing number re-activates and updates it.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { verifyChildBelongsToParent, ensureDeviceBelongsToChild } from '../children/children.service';
import { writeAuditLog } from '../shared/audit.service';
import { toOffset } from '../../utils/pagination';

export interface ContactInput {
  phone_number: string;
  contact_name?: string;
  rule_type?: 'ALLOW' | 'BLOCK';
  device_id?: string;
  is_active?: boolean;
}

const CONTACT_COLUMNS = `id, child_id, device_id, phone_number, contact_name, rule_type, is_active, created_at, updated_at`;

export const listContacts = async (
  parentId: string,
  childId: string,
  page = 1,
  limit = 20
): Promise<{ items: Array<Record<string, unknown>>; total: number }> => {
  await verifyChildBelongsToParent(childId, parentId);
  const count = await query(`SELECT COUNT(*)::int AS total FROM contact_rules WHERE child_id = $1`, [
    childId,
  ]);
  const result = await query(
    `SELECT ${CONTACT_COLUMNS}
     FROM contact_rules
     WHERE child_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [childId, limit, toOffset(page, limit)]
  );
  return { items: result.rows, total: count.rows[0].total };
};

export const createContact = async (
  parentId: string,
  childId: string,
  input: ContactInput
): Promise<Record<string, unknown>> => {
  await verifyChildBelongsToParent(childId, parentId);
  await ensureDeviceBelongsToChild(childId, input.device_id);

  const result = await query(
    `INSERT INTO contact_rules (child_id, device_id, phone_number, contact_name, rule_type)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (child_id, phone_number)
     DO UPDATE SET contact_name = EXCLUDED.contact_name,
                   rule_type = EXCLUDED.rule_type,
                   is_active = TRUE,
                   updated_at = now()
     RETURNING ${CONTACT_COLUMNS}`,
    [
      childId,
      input.device_id || null,
      input.phone_number,
      input.contact_name || null,
      input.rule_type ?? 'BLOCK',
    ]
  );
  const contact = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'CREATE_CONTACT',
    resourceType: 'contact_rules',
    details: { contact_id: contact.id, phone_number: contact.phone_number },
  });

  return contact;
};

export const updateContact = async (
  parentId: string,
  childId: string,
  contactId: string,
  input: Partial<ContactInput>
): Promise<Record<string, unknown>> => {
  await verifyChildBelongsToParent(childId, parentId);
  await ensureDeviceBelongsToChild(childId, input.device_id);

  const result = await query(
    `UPDATE contact_rules
     SET contact_name = COALESCE($4, contact_name),
         rule_type = COALESCE($5, rule_type),
         is_active = COALESCE($6, is_active),
         device_id = COALESCE($3, device_id),
         updated_at = now()
     WHERE id = $1 AND child_id = $2
     RETURNING ${CONTACT_COLUMNS}`,
    [
      contactId,
      childId,
      input.device_id ?? null,
      input.contact_name ?? null,
      input.rule_type ?? null,
      input.is_active === undefined ? null : input.is_active,
    ]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Contact rule not found for this child');
  }
  const contact = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'UPDATE_CONTACT',
    resourceType: 'contact_rules',
    details: { contact_id: contactId, phone_number: contact.phone_number },
  });

  return contact;
};

export const deleteContact = async (
  parentId: string,
  childId: string,
  contactId: string
): Promise<void> => {
  await verifyChildBelongsToParent(childId, parentId);
  const result = await query(
    `DELETE FROM contact_rules WHERE id = $1 AND child_id = $2`,
    [contactId, childId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Contact rule not found for this child');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: childId,
    action: 'DELETE_CONTACT',
    resourceType: 'contact_rules',
    details: { contact_id: contactId },
  });
};
