import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { ENV } from './config/env.js';
import { connectDatabase } from './config/database.js';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundMiddleware.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { trackSiteReach } from './middleware/reachTracker.js';
import { verifySmtpConnection } from './services/emailService.js';

const app: Application = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration - strict origin matching
const allowedOrigin: string = String(ENV.CLIENT_URL || 'http://localhost:5173');
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (origin === allowedOrigin || origin === allowedOrigin.replace(/\/$/, '')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-bootstrap-secret', 'x_admin_bootstrap_secret', 'admin-bootstrap-secret'],
  })
);

// Cookie parsing
app.use(cookieParser());

// HTTP request logger
if (ENV.NODE_ENV !== 'test') {
  app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Lightweight reach tracking for public visitors
app.use(trackSiteReach);

// Mount central API router
app.use('/api', apiRouter);

// 404 handler for unrecognized routes
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

// Start server
export const startServer = async () => {
  // Connect to MongoDB Atlas (or report configuration requirement)
  await connectDatabase();

  // Verify SMTP connection on startup without crashing
  await verifySmtpConnection();

  const server = app.listen(ENV.PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🛕  DevaSetu Server running on port ${ENV.PORT}`);
    console.log(`🌐  Environment: ${ENV.NODE_ENV}`);
    console.log(`🔒  CORS allowed origin: ${allowedOrigin}`);
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      console.log(`💳  Razorpay test payment configuration loaded`);
    }
    console.log(`==================================================\n`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ [Server]: Port ${ENV.PORT} is already in use by another process. Please stop any other running dev servers.`);
    } else {
      console.error(`❌ [Server]: Server listen error: ${err.message}`);
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  const handleShutdown = async (signal: string) => {
    console.log(`\n[Server]: Received ${signal}. Closing connections...`);
    try {
      await mongoose.disconnect();
      console.log('[Database]: Disconnected from MongoDB.');
    } catch (e) {}
    server.close(() => {
      console.log('[Server]: HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.once('SIGUSR2', () => handleShutdown('SIGUSR2'));

  return server;
};

startServer();

export default app;
