/**
 * DevaSetu Shared Business Enums & Union Types
 * Phase 1 TypeScript Foundation
 * Grounded directly on authoritative server models and client constants.
 */

// User Roles & Authentication
export const USER_ROLES = {
  DEVOTEE: 'DEVOTEE',
  ADMIN: 'ADMIN',
  TEMPLE_AUTHORITY: 'TEMPLE_AUTHORITY',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export const ALL_ROLES: UserRole[] = ['DEVOTEE', 'ADMIN', 'TEMPLE_AUTHORITY'];

// Temple Operational Status
export const TEMPLE_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
} as const;

export type TempleStatus = (typeof TEMPLE_STATUS)[keyof typeof TEMPLE_STATUS];

// Temple Registration Workflow Status
export const REGISTRATION_STATUS = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS];

// Service Types
export const SERVICE_TYPES = {
  DARSHAN: 'DARSHAN',
  SEVA: 'SEVA',
  POOJA: 'POOJA',
  SPECIAL_ENTRY: 'SPECIAL_ENTRY',
  PRASADAM: 'PRASADAM',
  DONATION: 'DONATION',
} as const;

export type ServiceType = (typeof SERVICE_TYPES)[keyof typeof SERVICE_TYPES];

// Booking Status
export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// Payment Providers
export const PAYMENT_PROVIDERS = {
  RAZORPAY: 'RAZORPAY',
  MANUAL: 'MANUAL',
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

// Devotee Review Moderation Status
export const REVIEW_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

// Notification Types
export const NOTIFICATION_TYPES = {
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  TEMPLE_UPDATE: 'TEMPLE_UPDATE',
  SERVICE_UPDATE: 'SERVICE_UPDATE',
  SYSTEM: 'SYSTEM',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Temple Announcement Types
export const ANNOUNCEMENT_TYPES = {
  GENERAL: 'GENERAL',
  IMPORTANT: 'IMPORTANT',
  FESTIVAL: 'FESTIVAL',
  DARSHAN: 'DARSHAN',
  SERVICE: 'SERVICE',
  NOTICE: 'NOTICE',
} as const;

export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[keyof typeof ANNOUNCEMENT_TYPES];

// Temple Recommendation Status (Admin to Authority)
export const RECOMMENDATION_STATUS = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
} as const;

export type RecommendationStatus = (typeof RECOMMENDATION_STATUS)[keyof typeof RECOMMENDATION_STATUS];

// Category Suggestion Status
export const SUGGESTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUS)[keyof typeof SUGGESTION_STATUS];

// Visit Plan Status
export const VISIT_PLAN_STATUS = {
  ACTIVE: 'ACTIVE',
  OUTDATED: 'OUTDATED',
} as const;

export type VisitPlanStatus = (typeof VISIT_PLAN_STATUS)[keyof typeof VISIT_PLAN_STATUS];

// Calendar Weekdays
export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

// Audit Actions
export const AUDIT_ACTIONS = {
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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// Audit Entity Types
export const AUDIT_ENTITY_TYPES = {
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
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];
