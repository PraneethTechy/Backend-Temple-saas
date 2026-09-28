/**
 * DevaSetu User Notification Types
 */
import type { ID } from './common.js';
import type { NotificationType } from './enums.js';

export interface NotificationMetadata {
  bookingId?: ID;
  templeId?: ID;
  serviceId?: ID;
  actionUrl?: string;
}

export interface Notification {
  _id: ID;
  userId: ID;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: NotificationMetadata;
  createdAt: string;
}
