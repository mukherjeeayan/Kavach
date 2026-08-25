// urlFilter.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as urlFilterService from './urlFilter.service';
import { respond } from '../../utils/response';

export const listRules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await urlFilterService.listRules(
      req.user!.userId, req.params.childId, page, limit
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const createRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await urlFilterService.createRule(
      req.user!.userId, req.params.childId, req.body
    );
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const updateRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await urlFilterService.updateRule(
      req.user!.userId, req.params.childId, req.params.ruleId, req.body
    );
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const deleteRule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await urlFilterService.deleteRule(req.user!.userId, req.params.childId, req.params.ruleId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) { next(err); }
};
