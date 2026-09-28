import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError.js';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Cannot find ${req.method} ${req.originalUrl} on this server`));
};

export default notFoundHandler;
