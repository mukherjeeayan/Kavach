// alerts.dto.ts
// Validation schemas for alerts requests.

import { z } from 'zod';

export const alertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  alert_type: z.enum([
    'TAMPER_ALERT',
    'SCREEN_TIME_LIMIT_REACHED',
    'PER_APP_LIMIT_REACHED',
    'DEVICE_ADMIN_STATUS',
    'KEYWORD_ALERT',
    'SELF_HARM_ALERT',
    'SOS_EVENT',
    'GEOFENCE_EVENT',
    'SECURITY_ALERT',
  ]).optional(),
  unacknowledged_only: z.coerce.boolean().default(false),
});

export type AlertsQueryInput = z.infer<typeof alertsQuerySchema>;
