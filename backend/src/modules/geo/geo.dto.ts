// geo.dto.ts
// Validation schemas for geo operations.

import { z } from 'zod';

/** GET /api/v1/geo/mapbox-token - no required parameters */
export const mapboxTokenSchema = z.object({});

export type MapboxTokenInput = z.infer<typeof mapboxTokenSchema>;
