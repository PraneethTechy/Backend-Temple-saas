import { getDatabaseStatus } from '../config/database.js';
import { ENV } from '../config/env.js';

export const getHealth = (req, res) => {
  const dbStatus = getDatabaseStatus();

  res.status(200).json({
    success: true,
    message: 'DevaSetu API is running',
    environment: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
};
