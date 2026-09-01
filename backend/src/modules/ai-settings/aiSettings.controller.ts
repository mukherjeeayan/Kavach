// aiSettings.controller.ts
// HTTP concerns for AI settings CRUD.

import { Request, Response, NextFunction } from 'express';
import * as aiSettingsService from './aiSettings.service';
import { respond } from '../../utils/response';

/**
 * GET /api/v1/ai/settings
 * List all AI settings for the current user.
 */
export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as { userId?: string }).userId!;
    const settings = await aiSettingsService.getAiSettings(userId);
    respond(res, 200, { settings }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/ai/settings
 * Create or update AI settings for a provider.
 */
export const upsertSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as { userId?: string }).userId!;
    const { provider, api_key, model } = req.body;
    const setting = await aiSettingsService.upsertAiSettings(userId, provider, api_key, model);
    respond(res, 200, { setting }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/ai/settings/:provider
 * Remove AI settings for a provider.
 */
export const deleteSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as { userId?: string }).userId!;
    const { provider } = req.params;
    await aiSettingsService.deleteAiSettings(userId, provider);
    respond(res, 200, { deleted: true }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/ai/test
 * Test an AI provider connection with the stored API key.
 */
export const testConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as { userId?: string }).userId!;
    const { provider } = req.body;
    const config = await aiSettingsService.getActiveAiConfig(userId);

    if (!config || config.provider !== provider) {
      respond(res, 400, { error: `No ${provider} API key configured` }, req);
      return;
    }

    // Simple test: send a minimal prompt
    const { generateAiResponse } = await import('../ai/ai.service');
    const result = await generateAiResponse(userId, 'Say "OK" in one word.');

    respond(res, 200, { success: true, response: result.slice(0, 50) }, req);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/ai/models/fetch
 * Fetch available models from a provider. Accepts the API key in the body
 * so users can fetch models before saving their key.
 */
export const fetchModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, api_key } = req.body;
    if (!provider || !api_key) {
      respond(res, 400, { error: 'provider and api_key are required' }, req);
      return;
    }
    const { providers } = await import('../ai/ai.service');
    const aiProvider = providers[provider];
    if (!aiProvider) {
      respond(res, 400, { error: `Unsupported provider: ${provider}` }, req);
      return;
    }
    const models = await aiProvider.listModels(api_key);
    respond(res, 200, { models }, req);
  } catch (err) {
    next(err);
  }
};
