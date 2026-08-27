// geo.routes.ts
// geo.routes.ts
// Mounted at: /api/v1/geo. Authenticated + parent-only.
import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { mapboxTokenSchema } from './geo.dto';
import * as geoController from './geo.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/geo/mapbox-token — runtime map credential delivery
router.get('/mapbox-token', validate(mapboxTokenSchema), geoController.getMapboxToken);

export default router;
