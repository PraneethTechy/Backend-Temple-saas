import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const AUDIT_ACTIONS = Object.freeze({
  TEMPLE_REGISTRATION_SUBMITTED: 'TEMPLE_REGISTRATION_SUBMITTED',
  TEMPLE_APPROVED: 'TEMPLE_APPROVED',
  TEMPLE_REJECTED: 'TEMPLE_REJECTED',
  TEMPLE_STATUS_UPDATED: 'TEMPLE_STATUS_UPDATED',
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_STATUS_TOGGLED: 'CATEGORY_STATUS_TOGGLED',
  CATEGORY_TEMPLE_ASSIGNED: 'CATEGORY_TEMPLE_ASSIGNED',
  CATEGORY_TEMPLE_REMOVED: 'CATEGORY_TEMPLE_REMOVED',
  CATEGORY_SUGGESTION_REVIEWED: 'CATEGORY_SUGGESTION_REVIEWED',
  AUTHORITY_CREATED: 'AUTHORITY_CREATED',
  AUTHORITY_CREDENTIALS_RESENT: 'AUTHORITY_CREDENTIALS_RESENT',
  USER_STATUS_UPDATED: 'USER_STATUS_UPDATED',
  DEVOTEE_STATUS_UPDATED: 'DEVOTEE_STATUS_UPDATED',
  BOOKING_ACTION: 'BOOKING_ACTION',
  PAYMENT_ACTION: 'PAYMENT_ACTION',
  REVIEW_APPROVED: 'REVIEW_APPROVED',
  REVIEW_REJECTED: 'REVIEW_REJECTED',
  RECOMMENDATION_CREATED: 'RECOMMENDATION_CREATED',
  RECOMMENDATION_STATUS_UPDATED: 'RECOMMENDATION_STATUS_UPDATED',
} as const);

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = Object.freeze({
  TEMPLE_REGISTRATION: 'TEMPLE_REGISTRATION',
  TEMPLE: 'TEMPLE',
  CATEGORY: 'CATEGORY',
  CATEGORY_SUGGESTION: 'CATEGORY_SUGGESTION',
  USER: 'USER',
  DEVOTEE: 'DEVOTEE',
  AUTHORITY: 'AUTHORITY',
  BOOKING: 'BOOKING',
  PAYMENT: 'PAYMENT',
  REVIEW: 'REVIEW',
  RECOMMENDATION: 'RECOMMENDATION',
} as const);

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

export interface IAuditLog {
  actorId: Types.ObjectId;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: Types.ObjectId | null;
  description: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface IAuditLogDocument extends Document<Types.ObjectId, {}, IAuditLog>, IAuditLog {}

export interface IAuditLogModel extends Model<IAuditLog> {}

const auditLogSchema = new Schema<IAuditLog, IAuditLogModel>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });

export const AuditLog: IAuditLogModel =
  (mongoose.models.AuditLog as IAuditLogModel) || mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', auditLogSchema);
export default AuditLog;
