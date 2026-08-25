// prediction.controller.ts

import { Request, Response, NextFunction } from 'express';
import * as predictionService from './prediction.service';
import { respond } from '../../utils/response';

export const listPredictions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await predictionService.listPredictions(
      req.user!.userId,
      req.params.childId
    );
    respond(res, 200, data, req);
  } catch (err) {
    next(err);
  }
};

export const generatePredictions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await predictionService.generatePredictions(
      req.user!.userId,
      req.params.childId
    );
    respond(res, 201, data, req);
  } catch (err) {
    next(err);
  }
};
