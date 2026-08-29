// settings.dto.ts
// Validation schemas for user settings requests.

import { z } from 'zod';

export const updateSettingsSchema = z.object({
  notifications_enabled: z.boolean().optional(),
  email_digest_enabled: z.boolean().optional(),
  digest_frequency: z.enum(['DAILY', 'WEEKLY']).optional(),
  screen_time_alerts: z.boolean().optional(),
  location_alerts: z.boolean().optional(),
  communication_alerts: z.boolean().optional(),
  sos_alerts: z.boolean().optional(),
  self_harm_alerts: z.boolean().optional(),
  dnd_enabled: z.boolean().optional(),
  dnd_start_time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM').optional(),
  dnd_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:MM').optional(),
});

export const pushTokenSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  device_type: z.enum(['android', 'ios', 'web']).default('android'),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type PushTokenInput = z.infer<typeof pushTokenSchema>;
