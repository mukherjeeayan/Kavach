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

/** PUT /devices/:deviceId/admin-status body. */
export const adminStatusSchema = z.object({
  admin_active: z.boolean({ required_error: 'admin_active is required' }),
});

/** PUT /devices/:deviceId/fcm-token body. */
export const fcmTokenSchema = z.object({
  fcm_token: z.string().max(255).nullable(),
});

/** POST /devices/:deviceId/heartbeat body. */
export const heartbeatSchema = z.object({
  heartbeat: z.string().datetime({ offset: true })
});

/** POST /devices/:deviceId/public-key body. */
export const registerPublicKeySchema = z.object({
  public_key: z.string().min(1, 'public_key is required'),
  key_type: z.enum(['ecdh', 'rsa']).default('ecdh'),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type AdminStatusInput = z.infer<typeof adminStatusSchema>;
export type FcmTokenInput = z.infer<typeof fcmTokenSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
export type RegisterPublicKeyInput = z.infer<typeof registerPublicKeySchema>;