// aiSettings.service.ts
// CRUD for user-provided AI provider settings. API keys are encrypted
// at rest using the DATA_ENCRYPTION_KEY.

import { query } from '../../config/database';
import { encryptSensitiveData, decryptSensitiveData } from '../shared/encryption.service';

export interface AiSettingsRecord {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  api_key_masked?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Mask an API key for safe display: show first 4 and last 4 chars.
 */
const maskApiKey = (key: string): string => {
  if (key.length <= 10) return '****';
  return `${key.slice(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
};

/**
 * Get all AI settings for a user (API keys are masked for display).
 */
export const getAiSettings = async (userId: string): Promise<AiSettingsRecord[]> => {
  const result = await query(
    `SELECT id, user_id, provider, api_key_enc, model, is_active, created_at, updated_at
     FROM ai_settings WHERE user_id = $1 ORDER BY provider`,
    [userId]
  );

  return result.rows.map((row: AiSettingsRecord & { api_key_enc: string }) => ({
    id: row.id,
    user_id: row.user_id,
    provider: row.provider,
    model: row.model,
    api_key_masked: maskApiKey(decryptSensitiveData(row.api_key_enc)),
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

/**
 * Get a single AI setting by provider.
 */
export const getAiSettingByProvider = async (
  userId: string,
  provider: string
): Promise<{ setting: AiSettingsRecord; apiKey: string } | null> => {
  const result = await query(
    `SELECT id, user_id, provider, api_key_enc, model, is_active, created_at, updated_at
     FROM ai_settings WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    setting: row as AiSettingsRecord,
    apiKey: decryptSensitiveData(row.api_key_enc),
  };
};

/**
 * Create or update AI settings for a provider.
 */
export const upsertAiSettings = async (
  userId: string,
  provider: string,
  apiKey: string,
  model: string
): Promise<AiSettingsRecord> => {
  const encryptedKey = encryptSensitiveData(apiKey);

  const result = await query(
    `INSERT INTO ai_settings (user_id, provider, api_key_enc, model)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET api_key_enc = EXCLUDED.api_key_enc,
                   model = EXCLUDED.model,
                   is_active = true,
                   updated_at = now()
     RETURNING id, user_id, provider, model, is_active, created_at, updated_at`,
    [userId, provider, encryptedKey, model]
  );

  return result.rows[0] as AiSettingsRecord;
};

/**
 * Delete AI settings for a provider.
 */
export const deleteAiSettings = async (userId: string, provider: string): Promise<boolean> => {
  const result = await query(
    `DELETE FROM ai_settings WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  return (result.rowCount ?? 0) > 0;
};

/**
 * Get the active AI config for a user (first active provider).
 * Returns null if no AI is configured.
 */
export const getActiveAiConfig = async (
  userId: string
): Promise<{ provider: string; apiKey: string; model: string } | null> => {
  const result = await query(
    `SELECT provider, api_key_enc, model
     FROM ai_settings WHERE user_id = $1 AND is_active = true
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    provider: row.provider,
    apiKey: decryptSensitiveData(row.api_key_enc),
    model: row.model,
  };
};
