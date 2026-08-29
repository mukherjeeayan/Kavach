// integration.service.ts
// Third-party integration management: CRUD + sync.

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import logger from '../../utils/logger';
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
): Promise<{ status: 'success' | 'error'; syncedAt: Date; details?: string }> => {
  const result = await query(
    `SELECT id, parent_id, integration_type, name, config, is_active
     FROM integrations
     WHERE id = $1 AND parent_id = $2 AND is_active = TRUE`,
    [integrationId, parentId]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Active integration not found for this parent');
  }

  const integration = result.rows[0];

  let syncResult: { status: 'success' | 'error'; details?: string };

  try {
    switch (integration.integration_type) {
      case 'CALENDAR':
        syncResult = await syncGoogleCalendar(integration);
        break;
      case 'HEALTH_APP':
        syncResult = await syncHealthConnect(integration);
        break;
      case 'SCHOOL_PORTAL':
        syncResult = await syncSchoolPortal(integration);
        break;
      case 'CUSTOM':
        syncResult = await syncCustomWebhook(integration);
        break;
      default:
        syncResult = { status: 'error', details: `Unknown integration type: ${integration.integration_type}` };
    }
  } catch (err: any) {
    syncResult = { status: 'error', details: err?.message ?? 'Sync failed' };
  }

  await query(
    `UPDATE integrations
     SET last_sync_at = NOW(),
         sync_status = $1,
         sync_error = $2
     WHERE id = $3`,
    [syncResult.status, syncResult.details ?? null, integrationId]
  );

  await writeAuditLog({
    actorId: parentId,
    targetChildId: null,
    action: 'INTEGRATION_SYNCED',
    resourceType: 'integrations',
    details: {
      integration_id: integrationId,
      type: integration.integration_type,
      status: syncResult.status,
    },
  });

  return { status: syncResult.status, syncedAt: new Date(), details: syncResult.details };
};

async function syncGoogleCalendar(integration: any): Promise<{ status: 'success' | 'error'; details?: string }> {
  const accessToken = integration.config?.access_token;
  if (!accessToken) {
    return { status: 'error', details: 'Missing access token' };
  }
  const response = await fetchWithRetry(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&timeMin=' +
      encodeURIComponent(new Date().toISOString()),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    return { status: 'error', details: `Google API returned ${response.status}` };
  }
  const data: any = await response.json();
  logger.info(`Synced ${data.items?.length || 0} calendar events for integration ${integration.id}`);
  return { status: 'success' };
}

async function syncHealthConnect(integration: any): Promise<{ status: 'success' | 'error'; details?: string }> {
  const accessToken = integration.config?.access_token;
  if (!accessToken) {
    return { status: 'error', details: 'Missing access token' };
  }
  const startTime = new Date(Date.now() - 86_400_000).toISOString();
  const response = await fetchWithRetry(
    'https://healthconnect.googleapis.com/v1/steps?startTime=' + encodeURIComponent(startTime),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    return { status: 'error', details: `Health API returned ${response.status}` };
  }
  return { status: 'success' };
}

async function syncSchoolPortal(integration: any): Promise<{ status: 'success' | 'error'; details?: string }> {
  const webhookUrl = integration.config?.webhook_url;
  if (!webhookUrl) {
    return { status: 'error', details: 'Missing webhook URL' };
  }
  const response = await fetchWithRetry(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync', timestamp: new Date().toISOString() }),
  });
  if (!response.ok) {
    return { status: 'error', details: `Webhook returned ${response.status}` };
  }
  return { status: 'success' };
}

async function syncCustomWebhook(integration: any): Promise<{ status: 'success' | 'error'; details?: string }> {
  const webhookUrl = integration.config?.webhook_url;
  if (!webhookUrl) {
    return { status: 'error', details: 'Missing webhook URL' };
  }
  const response = await fetchWithRetry(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sync',
      integration_id: integration.id,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    return { status: 'error', details: `Webhook returned ${response.status}` };
  }
  return { status: 'success' };
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err: any) {
      lastError = err;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error('All retries failed');
}
