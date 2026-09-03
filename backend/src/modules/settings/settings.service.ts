// settings.service.ts
// Business logic for user settings (notification preferences, DND, etc.).

import { query } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import type { UpdateSettingsInput } from './settings.dto';

export interface UserSettings {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  email_digest_enabled: boolean;
  digest_frequency: 'DAILY' | 'WEEKLY';
  screen_time_alerts: boolean;
  location_alerts: boolean;
  communication_alerts: boolean;
  sos_alerts: boolean;
  self_harm_alerts: boolean;
  dnd_enabled: boolean;
  dnd_start_time: string | null;
  dnd_end_time: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

// SECURITY: Whitelist of allowed column names to prevent SQL injection
const ALLOWED_SETTINGS_COLUMNS = new Set([
  'notifications_enabled',
  'email_digest_enabled',
  'digest_frequency',
  'screen_time_alerts',
  'location_alerts',
  'communication_alerts',
  'sos_alerts',
  'self_harm_alerts',
  'dnd_enabled',
  'dnd_start_time',
  'dnd_end_time',
]);

/**
 * Get or create settings for a user. Settings are created with
 * sensible defaults on first access.
 */
export const getSettings = async (userId: string): Promise<UserSettings> => {
  const result = await query(
    `SELECT * FROM user_settings WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length > 0) {
    return result.rows[0] as UserSettings;
  }

  // Create default settings
  const insertResult = await query(
    `INSERT INTO user_settings (user_id)
     VALUES ($1)
     RETURNING *`,
    [userId]
  );

  return insertResult.rows[0] as UserSettings;
};

/**
 * Update user settings. Only provided fields are updated.
 * SECURITY: Only columns in the whitelist are allowed to prevent SQL injection.
 */
export const updateSettings = async (
  userId: string,
  input: UpdateSettingsInput
): Promise<UserSettings> => {
  // Ensure settings exist
  await getSettings(userId);

  const fields: string[] = [];
  const values: (string | boolean | number)[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      // SECURITY: Validate key is in whitelist before interpolation
      if (!ALLOWED_SETTINGS_COLUMNS.has(key)) {
        continue; // Silently skip unknown fields
      }
      fields.push(`${key} = $${paramIndex}`);
      values.push(value as string | boolean | number);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    return getSettings(userId);
  }

  fields.push(`updated_at = now()`);
  values.push(userId);

  const result = await query(
    `UPDATE user_settings
     SET ${fields.join(', ')}
     WHERE user_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] as UserSettings;
};

/**
 * Save or update FCM push token for push notifications.
 */
export const savePushToken = async (
  userId: string,
  token: string,
  deviceType: string
): Promise<{ saved: boolean }> => {
  await getSettings(userId);

  const result = await query(
    `UPDATE user_settings
     SET push_token = $1, push_device_type = $2, updated_at = now()
     WHERE user_id = $3`,
    [token, deviceType, userId]
  );

  return { saved: (result.rowCount ?? 0) > 0 };
};
