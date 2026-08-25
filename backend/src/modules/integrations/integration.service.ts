// integration.service.ts
// Third-party integration management: CRUD + sync.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { writeAuditLog } from '../shared/audit.service';

export interface CreateIntegrationInput {
  integration_type: 'SCHOOL_PORTAL' | 'CALENDAR' | 'HEALTH_APP' | 'CUSTOM';
  name: string;
  config?: Record<string, unknown>;
}

export interface UpdateIntegrationInput {
  name?: string;
  config?: Record<string, unknown>;
  is_active?: boolean;
}

const INTEGRATION_COLUMNS = `id, parent_id, integration_type, name, config, is_active, last_sync_at, created_at`;

export const listIntegrations = async (
  parentId: string
): Promise<Array<Record<string, unknown>>> => {
  const result = await query(
    `SELECT ${INTEGRATION_COLUMNS}
     FROM integrations
     WHERE parent_id = $1
     ORDER BY created_at DESC`,
    [parentId]
  );
  return result.rows;
};

export const createIntegration = async (
  parentId: string,
  input: CreateIntegrationInput
): Promise<Record<string, unknown>> => {
  const result = await query(
    `INSERT INTO integrations (parent_id, integration_type, name, config)
     VALUES ($1, $2, $3, $4)
     RETURNING ${INTEGRATION_COLUMNS}`,
    [parentId, input.integration_type, input.name, JSON.stringify(input.config ?? {})]
  );

  const integration = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'INTEGRATION_CREATED',
    resourceType: 'integrations',
    details: { integration_id: integration.id, type: input.integration_type, name: input.name },
  });

  return integration;
};

export const updateIntegration = async (
  parentId: string,
  integrationId: string,
  input: UpdateIntegrationInput
): Promise<Record<string, unknown>> => {
  const result = await query(
    `UPDATE integrations
     SET name = COALESCE($3, name),
         config = COALESCE($4, config),
         is_active = COALESCE($5, is_active)
     WHERE id = $1 AND parent_id = $2
     RETURNING ${INTEGRATION_COLUMNS}`,
    [
      integrationId,
      parentId,
      input.name ?? null,
      input.config ? JSON.stringify(input.config) : null,
      input.is_active === undefined ? null : input.is_active,
    ]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Integration not found for this parent');
  }

  const integration = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'INTEGRATION_UPDATED',
    resourceType: 'integrations',
    details: { integration_id: integrationId, fields_updated: Object.keys(input) },
  });

  return integration;
};

export const deleteIntegration = async (
  parentId: string,
  integrationId: string
): Promise<void> => {
  const result = await query(
    `DELETE FROM integrations WHERE id = $1 AND parent_id = $2`,
    [integrationId, parentId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError('Integration not found for this parent');
  }

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'INTEGRATION_DELETED',
    resourceType: 'integrations',
    details: { integration_id: integrationId },
  });
};

export const syncIntegration = async (
  parentId: string,
  integrationId: string
): Promise<Record<string, unknown>> => {
  const result = await query(
    `UPDATE integrations
     SET last_sync_at = now()
     WHERE id = $1 AND parent_id = $2 AND is_active = TRUE
     RETURNING ${INTEGRATION_COLUMNS}`,
    [integrationId, parentId]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Active integration not found for this parent');
  }

  const integration = result.rows[0];

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'INTEGRATION_SYNCED',
    resourceType: 'integrations',
    details: { integration_id: integrationId, type: integration.integration_type },
  });

  return integration;
};
