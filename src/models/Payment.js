import mongoose from 'mongoose';
import { PAYMENT_STATUS } from './Booking.js';

export const PAYMENT_PROVIDERS = Object.freeze({
  RAZORPAY: 'RAZORPAY',
  MANUAL: 'MANUAL',
});

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    templeId: {
      type: mongoose.Schema.Types.ObjectId,
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

export const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
