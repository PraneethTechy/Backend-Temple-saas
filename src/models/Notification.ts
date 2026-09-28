import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const NOTIFICATION_TYPES = Object.freeze({
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  TEMPLE_UPDATE: 'TEMPLE_UPDATE',
  SERVICE_UPDATE: 'SERVICE_UPDATE',
  SYSTEM: 'SYSTEM',
} as const);

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface INotificationMetadata {
  bookingId?: Types.ObjectId | null;
  templeId?: Types.ObjectId | null;
  serviceId?: Types.ObjectId | null;
  actionUrl?: string | null;
}

export interface INotification {
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: INotificationMetadata;
  createdAt?: Date;
}

export interface INotificationDocument extends Document<Types.ObjectId, {}, INotification>, INotification {}

export interface INotificationModel extends Model<INotification> {}

const notificationSchema = new Schema<INotification, INotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: Object.values(NOTIFICATION_TYPES),
        message: '{VALUE} is not a valid notification type',
      },
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
        default: null,
      },
      templeId: {
        type: Schema.Types.ObjectId,
        ref: 'Temple',
        default: null,
      },
      serviceId: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        default: null,
      },
      actionUrl: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Notifications only track creation time
  }
);

// Indexes
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification: INotificationModel =
  (mongoose.models.Notification as INotificationModel) ||
  mongoose.model<INotification, INotificationModel>('Notification', notificationSchema);
export default Notification;
