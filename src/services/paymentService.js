import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ENV } from '../config/env.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

let razorpayInstance = null;

/**
 * Initializes and returns the Razorpay client in TEST MODE.
 * Validates environment variables safely without printing secrets.
 */
export const getRazorpayClient = () => {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  const keyId = process.env.RAZORPAY_KEY_ID || ENV.RAZORPAY?.KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ENV.RAZORPAY?.KEY_SECRET;

  if (!keyId || !keySecret) {
    logger.error('[PaymentService] Razorpay credentials missing. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.');
    throw ApiError.internal('Payment gateway is currently unavailable. Missing gateway configuration.');
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  logger.info('Razorpay test payment configuration loaded');
  return razorpayInstance;
};

/**
 * Create a new Razorpay order
 * @param {Object} params
 * @param {number} params.amount - Amount in INR (will be converted to paise)
 * @param {string} params.currency - Default 'INR'
 * @param {string} params.receipt - Booking reference
 * @param {Object} params.notes - Optional metadata notes
 * @returns {Promise<Object>} Razorpay order
 */
export const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  try {
    const rzp = getRazorpayClient();

    // Razorpay amount must be in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      throw ApiError.badRequest('Invalid payment amount for order creation.');
    }

    const options = {
      amount: amountInPaise,
      currency: currency.toUpperCase(),
      receipt: String(receipt).slice(0, 40), // Razorpay receipt max 40 chars
      notes,
    };

    const order = await rzp.orders.create(options);
    return order;
  } catch (error) {
    logger.error(`[PaymentService] Order creation failed: ${error.message}`);
    if (error.statusCode) {
      throw error;
    }
    throw ApiError.internal(`Failed to create payment order: ${error.message}`);
  }
};

/**
 * Verifies Razorpay payment signature
 * HMAC SHA256 digest of `${orderId}|${paymentId}` signed with RAZORPAY_KEY_SECRET
 * @param {Object} params
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @param {string} params.signature - Razorpay signature received from client
 * @returns {boolean} True if signature is valid
 */
export const verifySignature = ({ orderId, paymentId, signature }) => {
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
  } catch (error) {
    logger.error(`[PaymentService] Signature verification exception: ${error.message}`);
    return false;
  }
};

export default {
  getRazorpayClient,
  createOrder,
  verifySignature,
};
