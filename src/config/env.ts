import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the server root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export interface EnvironmentConfig {
  PORT: number | string;
  NODE_ENV: string;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ADMIN_BOOTSTRAP_SECRET: string;
  CLIENT_URL: string;
  CLOUDINARY: {
    CLOUD_NAME: string;
    API_KEY: string;
    API_SECRET: string;
  };
  SMTP: {
    HOST: string;
    PORT: string;
    USER: string;
    PASSWORD: string;
  };
  RAZORPAY: {
    KEY_ID: string;
    KEY_SECRET: string;
  };
}

export const ENV: EnvironmentConfig = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'devasetu_jwt_dev_fallback_secret_key_change_in_production_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_BOOTSTRAP_SECRET: process.env.ADMIN_BOOTSTRAP_SECRET || 'DevaSetu_Bootstrap_Secret_Key_2026_Secured',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    API_KEY: process.env.CLOUDINARY_API_KEY || '',
    API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  },
  SMTP: {
    HOST: process.env.SMTP_HOST || '',
    PORT: process.env.SMTP_PORT || '',
    USER: process.env.SMTP_USER || '',
    PASSWORD: process.env.SMTP_PASSWORD || '',
  },
  RAZORPAY: {
    KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  },
};

export default ENV;
