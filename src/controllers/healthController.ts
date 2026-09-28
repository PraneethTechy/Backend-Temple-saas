import type { Request, Response } from 'express';
import { getDatabaseStatus } from '../config/database.js';
import { ENV } from '../config/env.js';

export const getHealth = (_req: Request, res: Response): void => {
  const dbStatus = getDatabaseStatus();

  res.status(200).json({
    success: true,
    message: 'DevaSetu API is running',
    environment: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
};

export default {
  getHealth,
};
