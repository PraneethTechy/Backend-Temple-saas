import { ApiError } from '../utils/apiError.js';

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Cannot find ${req.method} ${req.originalUrl} on this server`));
};
