import type { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.js';

export interface AppErrorLike extends Error {
  statusCode?: number;
  errors?: unknown[];
  code?: number | string;
}

export interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown[];
  stack?: string;
}

export const errorHandler = (
  err: AppErrorLike,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  const response: ErrorResponseBody = {
    success: false,
    statusCode,
    message,
    ...(Array.isArray(err.errors) && err.errors.length > 0 && { errors: err.errors }),
  };

  // Only expose stack trace in non-production environments
  if (ENV.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
