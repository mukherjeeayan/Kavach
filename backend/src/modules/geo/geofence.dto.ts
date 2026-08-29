// geofence.dto.ts
// Validation schemas for geofence CRUD operations.

import { z } from 'zod';

export const createGeofenceSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(1, 'name cannot be empty')
    .max(255),
  latitude: z
    .number({ required_error: 'latitude is required' })
    .min(-90)
    .max(90),
  longitude: z
    .number({ required_error: 'longitude is required' })
    .min(-180)
    .max(180),
  radius_meters: z
    .number({ required_error: 'radius_meters is required' })
    .min(50, 'radius must be at least 50 meters')
    .max(50000, 'radius cannot exceed 50 km'),
  zone_type: z.enum(['HOME', 'SCHOOL', 'FRIEND', 'CUSTOM']).default('CUSTOM'),
  alert_on_entry: z.boolean().default(false),
  alert_on_exit: z.boolean().default(true),
  device_id: z.string().uuid('must be a valid UUID').optional(),
  is_active: z.boolean().default(true),
});

export const updateGeofenceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius_meters: z.number().min(50).max(50000).optional(),
  zone_type: z.enum(['HOME', 'SCHOOL', 'FRIEND', 'CUSTOM']).optional(),
  alert_on_entry: z.boolean().optional(),
  alert_on_exit: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type CreateGeofenceInput = z.infer<typeof createGeofenceSchema>;
export type UpdateGeofenceInput = z.infer<typeof updateGeofenceSchema>;

export const checkGeofenceSchema = z.object({
  latitude: z
    .number({ required_error: 'latitude is required' })
    .min(-90)
    .max(90),
  longitude: z
    .number({ required_error: 'longitude is required' })
    .min(-180)
    .max(180),
});

export type CheckGeofenceInput = z.infer<typeof checkGeofenceSchema>;
