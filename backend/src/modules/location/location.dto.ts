// location.dto.ts
// Validation schemas for location pings.

import { z } from 'zod';

export const locationUploadSchema = z.object({
  latitude: z.number({ required_error: 'latitude is required' }).min(-90).max(90),
  longitude: z.number({ required_error: 'longitude is required' }).min(-180).max(180),
  accuracy_m: z.number().min(0).optional(),
  speed_kmh: z.number().min(0).optional(),
  // ISO-8601; defaults to server time.
  recorded_at: z.string().datetime().optional(),
});

export type LocationUploadInput = z.infer<typeof locationUploadSchema>;
