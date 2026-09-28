/**
 * DevaSetu Environment Configuration Type Definitions
 * Declares expected configuration keys for client and server.
 */

export interface ClientEnv {
  VITE_API_BASE_URL?: string;
  VITE_APP_URL?: string;
  VITE_GOOGLE_MAPS_API_KEY?: string;
}

export interface ServerEnv {
  PORT?: string | number;
  NODE_ENV?: 'development' | 'production' | 'test';
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;
  ADMIN_BOOTSTRAP_SECRET?: string;
  CLIENT_URL?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string | number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  MOCK_EMAIL?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_SITE_URL?: string;
  OPENROUTER_SITE_NAME?: string;
  GOOGLE_MAPS_API_KEY?: string;
}
