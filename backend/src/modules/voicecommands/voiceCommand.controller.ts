// voiceCommand.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as voiceCommandService from './voiceCommand.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { respond } from '../../utils/response';

export const recordCommand = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await voiceCommandService.recordCommand(
      req.params.deviceId,
      req.body
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};

export const listCommands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const { items, total } = await voiceCommandService.listCommands(
      req.user!.userId,
      req.params.childId,
      page,
      limit
    );
    respond(res, 200, { commands: items, pagination: buildPaginationMeta(page, limit, total) }, req);
  } catch (err) {
    next(err);
  }
};
