import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { PAYMENT_STATUS, type PaymentStatus } from './Booking.js';

export const PAYMENT_PROVIDERS = Object.freeze({
  RAZORPAY: 'RAZORPAY',
  MANUAL: 'MANUAL',
} as const);

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

export interface IPayment {
  bookingId: Types.ObjectId;
  userId: Types.ObjectId;
  templeId: Types.ObjectId;
  amount: number;
  currency?: string;
  provider: PaymentProvider;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  status: PaymentStatus;
  failureReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPaymentDocument extends Document<Types.ObjectId, {}, IPayment>, IPayment {}

export interface IPaymentModel extends Model<IPayment> {}

const paymentSchema = new Schema<IPayment, IPaymentModel>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    templeId: {
      type: Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_PROVIDERS),
        message: '{VALUE} is not a valid payment provider',
      },
      default: PAYMENT_PROVIDERS.RAZORPAY,
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    providerPaymentId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(PAYMENT_STATUS),
        message: '{VALUE} is not a valid payment status',
      },
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ templeId: 1, status: 1 });

export const Payment: IPaymentModel =
  (mongoose.models.Payment as IPaymentModel) || mongoose.model<IPayment, IPaymentModel>('Payment', paymentSchema);
export default Payment;
