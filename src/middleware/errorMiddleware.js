import { ENV } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const response = {
    success: false,
    statusCode,
    message,
    ...(err.errors && err.errors.length > 0 && { errors: err.errors }),
  };

  // Only expose stack trace in non-production environments
  if (ENV.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
