// notifications.dto.ts
// Validation schemas for notifications requests.

import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unread_only: z.coerce.boolean().default(false),
  notification_type: z.string().optional(),
});

export type NotificationsQueryInput = z.infer<typeof notificationsQuerySchema>;
