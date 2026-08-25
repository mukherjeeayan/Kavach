// integration.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as integrationService from './integration.service';
import { respond } from '../../utils/response';

export const listIntegrations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await integrationService.listIntegrations(req.user!.userId);
    respond(res, 200, { integrations: data }, req);
  } catch (err) {
    next(err);
  }
};

export const createIntegration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await integrationService.createIntegration(req.user!.userId, req.body);
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const updateIntegration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await integrationService.updateIntegration(
      req.user!.userId,
      req.params.integrationId,
      req.body
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const deleteIntegration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await integrationService.deleteIntegration(req.user!.userId, req.params.integrationId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) {
    next(err);
  }
};

export const syncIntegration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await integrationService.syncIntegration(
      req.user!.userId,
      req.params.integrationId
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};
