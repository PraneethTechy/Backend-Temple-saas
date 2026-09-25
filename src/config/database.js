import dns from 'dns';
import mongoose from 'mongoose';
import { ENV } from './env.js';

// Resolve MongoDB Atlas SRV records reliably on Windows / local ISP DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Fallback to system default if custom DNS cannot be configured
}

let isConnected = false;

export const connectDatabase = async (retries = 3) => {
  let uri = ENV.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    console.warn(
      '\n⚠️  [Database Configuration Notice]: MONGODB_URI is currently empty in server/.env.\n' +
      '   MongoDB connection was not attempted.\n' +
      '   Please provide your MongoDB Atlas connection string in server/.env when ready.\n'
    );
    isConnected = false;
    return;
  }

  // Normalize Atlas SRV string if database path is omitted
  if (uri.startsWith('mongodb+srv://') && !uri.split('?')[0].includes('.mongodb.net/')) {
    const parts = uri.split('?');
    const base = parts[0].replace(/\/$/, '') + '/devasetu';
    const params = parts[1] || 'retryWrites=true&w=majority';
    uri = `${base}?${params}`;
  }

  while (retries > 0) {
    try {
      const connection = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10,
        minPoolSize: 1,
      });
      isConnected = true;
      console.log(`✅ [Database]: MongoDB connected successfully to host: ${connection.connection.host}`);
      return;
    } catch (error) {
      retries--;
      if (retries === 0) {
        isConnected = false;
        console.error(`❌ [Database]: MongoDB connection error: ${error.message}`);
      } else {
        console.warn(`⚠️  [Database]: Connection attempt failed (${error.message}). Retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
};

export const getDatabaseStatus = () => {
  if (!ENV.MONGODB_URI || ENV.MONGODB_URI.trim() === '') {
    return {
      status: 'unconfigured',
      message: 'MONGODB_URI is not set in server/.env',
    };
  }

  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const currentState = mongoose.connection.readyState;
  return {
    status: stateMap[currentState] || 'unknown',
    message: currentState === 1 ? 'MongoDB connected' : 'MongoDB not connected',
  };
};
