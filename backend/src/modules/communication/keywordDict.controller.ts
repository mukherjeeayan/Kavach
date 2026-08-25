// keywordDict.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as keywordDictService from './keywordDict.service';
import { respond } from '../../utils/response';

export const listKeywords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const category = req.query.category as string | undefined;
    const activeOnly = req.query.active_only === 'true';
    const data = await keywordDictService.listKeywords(page, limit, category, activeOnly);
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const createKeyword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await keywordDictService.createKeyword(req.body);
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const bulkCreateKeywords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await keywordDictService.bulkCreateKeywords(req.body);
    respond(res, 201, data, req);
  } catch (err) { next(err); }
};

export const updateKeyword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await keywordDictService.updateKeyword(req.params.keywordId, req.body);
    respond(res, 200, data, req);
  } catch (err) { next(err); }
};

export const deleteKeyword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await keywordDictService.deleteKeyword(req.params.keywordId);
    respond(res, 200, { deleted: true }, req);
  } catch (err) { next(err); }
};
