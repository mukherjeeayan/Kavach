// deviceHealth.dto.ts
// Validation schemas for device health telemetry.

import { z } from 'zod';

export const recordHealthSchema = z.object({
  battery_level: z.number().int().min(0).max(100).optional(),
  is_charging: z.boolean().optional(),
  storage_total_mb: z.number().int().positive().optional(),
  storage_free_mb: z.number().int().min(0).optional(),
  is_rooted: z.boolean().default(false),
  is_developer_options: z.boolean().default(false),
  is_usb_debugging: z.boolean().default(false),
  os_version: z.string().max(50).optional(),
  app_version: z.string().max(50).optional(),
});

export type RecordHealthInput = z.infer<typeof recordHealthSchema>;
