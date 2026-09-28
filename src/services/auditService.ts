import type { Types } from 'mongoose';
import { AuditLog, type IAuditLogDocument, type AuditAction, type AuditEntityType } from '../models/AuditLog.js';
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

const sanitizeMetadata = (obj: unknown): unknown => {
  if (!obj || typeof obj !== 'object') return obj;
  const safe: Record<string, any> = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
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

export interface LogAuditActivityParams {
  actorId: Types.ObjectId | string;
  actorRole: string;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId?: Types.ObjectId | string | null;
  description: string;
  metadata?: Record<string, any>;
}

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
}: LogAuditActivityParams): Promise<IAuditLogDocument | null> => {
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

    return logEntry as IAuditLogDocument;
  } catch (error: any) {
    logger.error(`[AuditService] Failed to record audit log: ${error.message}`);
    return null;
  }
};

export default {
  logAuditActivity,
};
