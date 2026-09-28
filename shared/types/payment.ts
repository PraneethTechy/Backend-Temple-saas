/**
 * DevaSetu Payment Gateway & Transaction Types
 */
import type { ID, Timestamps } from './common.js';
import type { PaymentProvider, PaymentStatus } from './enums.js';

export interface Payment extends Timestamps {
  _id: ID;
  bookingId: ID;
  userId: ID;
  templeId: ID;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  failureReason?: string;
}

export interface CreatePaymentOrderInput {
  bookingId: ID;
}

export interface CreatePaymentOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  bookingId: ID;
}

export interface VerifyPaymentResult {
  verified: boolean;
  bookingId: ID;
  paymentId: ID;
}
