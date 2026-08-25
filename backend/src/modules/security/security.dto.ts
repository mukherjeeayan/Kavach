// security.dto.ts
// Validation schemas for security scans and WiFi logs.

import { z } from 'zod';

export const createSecurityScanSchema = z.object({
  scan_type: z.enum(['ROOT', 'KEYLOGGER', 'WIFI', 'APP_INTEGRITY', 'FULL'], {
    required_error: 'scan_type is required',
  }),
  result: z.record(z.unknown()).default({}),
  threats_found: z.number().int().min(0).default(0),
});

export const createWifiLogSchema = z.object({
  ssid: z.string().max(255).optional(),
  bssid: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, 'must be a valid MAC address')
    .optional(),
  security_type: z.string().max(50).optional(),
  is_open: z.boolean().default(false),
  is_known: z.boolean().default(true),
  ip_address: z.string().max(45).optional(),
});

export type CreateSecurityScanInput = z.infer<typeof createSecurityScanSchema>;
export type CreateWifiLogInput = z.infer<typeof createWifiLogSchema>;
