import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

export interface RazorpayOrderOptions {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string | number | boolean | undefined>;
  [key: string]: unknown;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: string;
  attempts: number;
  notes: Record<string, unknown>;
  created_at: number;
  [key: string]: unknown;
}

export interface IRazorpayClient {
  orders: {
    create: (options: RazorpayOrderOptions) => Promise<RazorpayOrder>;
  };
}

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string | number | boolean | undefined>;
}

export interface VerifySignatureParams {
  orderId?: string;
  paymentId?: string;
  signature?: string;
}

let razorpayInstance: IRazorpayClient | null = null;

/**
 * Initializes and returns the Razorpay client in TEST MODE.
 * Validates environment variables safely without printing secrets.
 */
export const getRazorpayClient = (): IRazorpayClient => {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  const keyId = process.env.RAZORPAY_KEY_ID || ENV.RAZORPAY?.KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ENV.RAZORPAY?.KEY_SECRET;

  if (!keyId || !keySecret) {
    logger.error('[PaymentService] Razorpay credentials missing. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.');
    throw ApiError.internal('Payment gateway is currently unavailable. Missing gateway configuration.');
  }

  // Cast through unknown to the boundary interface IRazorpayClient
  const client = new (Razorpay as unknown as new (options: { key_id: string; key_secret: string }) => IRazorpayClient)({
    key_id: keyId,
    key_secret: keySecret,
  });

  razorpayInstance = client;
  logger.info('Razorpay test payment configuration loaded');
  return razorpayInstance;
};

/**
 * Create a new Razorpay order
 * @param params Order parameters including amount in INR
 * @returns Promise resolving to created Razorpay order
 */
export const createOrder = async ({
  amount,
  currency = 'INR',
  receipt,
  notes = {},
}: CreateOrderParams): Promise<RazorpayOrder> => {
  try {
    const rzp = getRazorpayClient();

    // Razorpay amount must be in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      throw ApiError.badRequest('Invalid payment amount for order creation.');
    }

    const options: RazorpayOrderOptions = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: String(receipt).slice(0, 40), // Razorpay receipt max 40 chars
      notes,
    };

    const order = await rzp.orders.create(options);
    return order;
  } catch (error: unknown) {
    const err = error as { message?: string; statusCode?: number };
    logger.error(`[PaymentService] Order creation failed: ${err.message || 'Unknown error'}`);
    if (err.statusCode) {
      throw error;
    }
    throw ApiError.internal(`Failed to create payment order: ${err.message || 'Unknown error'}`);
  }
};

/**
 * Verifies Razorpay payment signature
 * HMAC SHA256 digest of `${orderId}|${paymentId}` signed with RAZORPAY_KEY_SECRET
 * @param params Verification parameters containing orderId, paymentId, and signature
 * @returns True if signature is valid, false otherwise
 */
export const verifySignature = ({ orderId, paymentId, signature }: VerifySignatureParams): boolean => {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || ENV.RAZORPAY?.KEY_SECRET;
    if (!keySecret) {
      logger.error('[PaymentService] Secret key missing for signature verification.');
      return false;
    }

    if (!orderId || !paymentId || !signature) {
      return false;
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.error(`[PaymentService] Signature verification exception: ${err.message || 'Unknown error'}`);
    return false;
  }
};

export default {
  getRazorpayClient,
  createOrder,
  verifySignature,
};
