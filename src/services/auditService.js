import { AuditLog } from '../models/AuditLog.js';
import logger from '../utils/logger.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'temporaryPassword',
  'passwordHash',
  'token',
  'refreshToken',
  'jwt',
  'secret',
  'razorpayKeySecret',
  'razorpaySignature',
  'cardNumber',
  'cvv',
]);

const sanitizeMetadata = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const safe = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      safe[key] = sanitizeMetadata(value);
    } else {
      safe[key] = value;
    }
  }
  return safe;
};

/**
 * Record a security or administrative activity in the AuditLog collection.
 * Non-blocking: catches internal errors so audit logging failures never fail customer requests.
 */
export const logAuditActivity = async ({
  actorId,
  actorRole,
  action,
  entityType,
  entityId = null,
  description,
  metadata = {},
}) => {
  try {
    if (!actorId || !action || !entityType || !description) {
      return null;
    }

    const safeMeta = sanitizeMetadata(metadata);

    const logEntry = await AuditLog.create({
      actorId,
      actorRole: actorRole || 'UNKNOWN',
      action,
      entityType,
      entityId,
      description,
      metadata: safeMeta,
    });

    return logEntry;
  } catch (error) {
    logger.error(`[AuditService] Failed to record audit log: ${error.message}`);
    return null;
  }
};

export default {
  logAuditActivity,
};
