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
import { initSocket, getIO } from './services/socketService.js';

const app: Application = express();

// ==================================================
// Security HTTP headers
// ==================================================

app.use(helmet());

// ==================================================
// CORS configuration
// ==================================================

// ==================================================
// CORS configuration
// ==================================================

const allowedOrigins: string[] = [
  // Local development
  'http://localhost:5173',

  // Previous Vercel deployment
  'https://temple-blond.vercel.app',

  // AWS Amplify production frontend
  'https://main.d2d8a4sp0475kj.amplifyapp.com',

  // Optional environment-based frontend URL
  ENV.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests without an Origin header
      // (Postman, curl, server-to-server requests, etc.)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      const isAllowed = allowedOrigins.some(
        (allowed) =>
          normalizedOrigin === allowed.replace(/\/$/, '')
      );

      if (isAllowed) {
        return callback(null, true);
      }

      console.error(
        `❌ CORS blocked origin: ${origin}`
      );

      return callback(
        new Error(
          `CORS policy violation: Origin ${origin} not allowed`
        )
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-admin-bootstrap-secret',
      'x_admin_bootstrap_secret',
      'admin-bootstrap-secret',
    ],
  })
);
// ==================================================
// Cookie parsing
// ==================================================

app.use(cookieParser());

// ==================================================
// HTTP request logger
// ==================================================

if (ENV.NODE_ENV !== 'test') {
  app.use(
    morgan(
      ENV.NODE_ENV === 'production'
        ? 'combined'
        : 'dev'
    )
  );
}

// ==================================================
// Body parsing
// ==================================================

app.use(
  express.json({
    limit: '10mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// ==================================================
// Lightweight reach tracking
// ==================================================

app.use(trackSiteReach);

// ==================================================
// Mount central API router
// ==================================================

app.use('/api', apiRouter);

// ==================================================
// 404 handler
// ==================================================

app.use(notFoundHandler);

// ==================================================
// Centralized error handling
// ==================================================

app.use(errorHandler);

// ==================================================
// Start server
// ==================================================

export const startServer = async () => {
  // Connect to MongoDB Atlas
  await connectDatabase();

  // Verify SMTP connection on startup without crashing
  await verifySmtpConnection();

  const server = app.listen(ENV.PORT, () => {
    console.log(
      `\n==================================================`
    );

    console.log(
      `🛕  DevaSetu Server running on port ${ENV.PORT}`
    );

    console.log(
      `🌐  Environment: ${ENV.NODE_ENV}`
    );

    console.log(
      `🔒  CORS allowed origins: ${allowedOrigins.join(', ')}`
    );

    if (
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
    ) {
      console.log(
        `💳  Razorpay test payment configuration loaded`
      );
    }

    console.log(
      `==================================================\n`
    );
  });

  // Initialize Socket.IO for messaging and real-time typing indicators
  initSocket(server);

  // ==================================================
  // Server error handling
  // ==================================================

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `❌ [Server]: Port ${ENV.PORT} is already in use by another process.`
      );

      console.error(
        `Please stop any other running dev servers.`
      );
    } else {
      console.error(
        `❌ [Server]: Server listen error: ${err.message}`
      );
    }

    process.exit(1);
  });

  // ==================================================
  // Graceful shutdown
  // ==================================================

  const handleShutdown = async (signal: string) => {
    console.log(
      `\n[Server]: Received ${signal}. Closing connections...`
    );

    try {
      getIO()?.close();
      await mongoose.disconnect();

      console.log(
        '[Database]: Disconnected from MongoDB.'
      );
    } catch (e) {
      console.error(
        '[Database]: Error while disconnecting from MongoDB.'
      );
    }

    server.close(() => {
      console.log(
        '[Server]: HTTP server closed.'
      );

      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    handleShutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    handleShutdown('SIGTERM');
  });

  process.once('SIGUSR2', () => {
    handleShutdown('SIGUSR2');
  });

  return server;
};

// ==================================================
// Start application
// ==================================================

if (process.env.NODE_ENV !== 'test' && ENV.NODE_ENV !== 'test') {
  startServer();
}

export default app;