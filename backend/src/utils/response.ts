// response.ts
// Shared JSON response formatter used by all controllers.
import { Response, Request } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: unknown;
  timestamp: string;
  request_id: string | undefined;
}

export const respond = <T>(
  res: Response,
  status: number,
  data: T,
  req: Request
): void => {
  res.status(status).json({
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
  } as ApiResponse<T>);
};
