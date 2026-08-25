// keywordDict.routes.ts
// Admin routes for managing the keyword detection dictionary.

import { Router } from 'express';
import { authenticateJWT, requireRole } from '../../middleware/auth';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { paginationQuery } from '../../middleware/params';
import { createKeywordSchema, updateKeywordSchema, bulkCreateKeywordsSchema } from './keywordDict.dto';
import * as keywordDictController from './keywordDict.controller';

const router = Router({ mergeParams: true });

router.use(authenticateJWT);
router.use(requireRole('parent'));

// GET /api/v1/keywords?category=CYBERBULLYING&active_only=true&page=1&limit=50
router.get(
  '/',
  validateQuery(paginationQuery),
  keywordDictController.listKeywords
);

// POST /api/v1/keywords
router.post(
  '/',
  validate(createKeywordSchema),
  keywordDictController.createKeyword
);

// POST /api/v1/keywords/bulk
router.post(
  '/bulk',
  validate(bulkCreateKeywordsSchema),
  keywordDictController.bulkCreateKeywords
);

// PUT /api/v1/keywords/:keywordId
router.put(
  '/:keywordId',
  validate(updateKeywordSchema),
  keywordDictController.updateKeyword
);

// DELETE /api/v1/keywords/:keywordId
router.delete(
  '/:keywordId',
  keywordDictController.deleteKeyword
);

export default router;
