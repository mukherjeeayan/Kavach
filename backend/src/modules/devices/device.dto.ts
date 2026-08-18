// device.dto.ts
// Validation schemas for device registration request bodies.

import { z } from 'zod';

const uuidSchema = z.string().uuid('must be a valid UUID');

export const registerDeviceSchema = z.object({
  child_id: uuidSchema,
  // When the app already registered this install before, passing the
  // existing device_id makes registration idempotent: the server
  // updates the device record instead of creating a duplicate.
  device_id: uuidSchema.optional(),
  device_name: z
    .string({ required_error: 'device_name is required' })
    .min(1, 'device_name cannot be empty')
    .max(255, 'device_name cannot exceed 255 characters'),
  device_type: z.enum(['android', 'ios', 'web']).default('android'),
  os_version: z.string().max(50).optional(),
  fcm_token: z.string().max(255).optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;