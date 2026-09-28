import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Payment, PAYMENT_PROVIDERS } from '../models/Payment.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Service } from '../models/Service.js';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';
import paymentService from '../services/paymentService.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import { ENV } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

interface CreatePaymentOrderBody {
  bookingId?: string;
}

interface VerifyPaymentBody {
  bookingId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}

/**
 * Create Razorpay Order for a Devotee Booking
 * POST /api/payments/create-order
 * Authenticated DEVOTEE only
 */
export const createPaymentOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    // 1. Authenticate user and verify DEVOTEE role
    if (!req.user || req.user.role !== 'DEVOTEE') {
      throw ApiError.forbidden('Only devotees can initiate payment orders.');
    }

    const { bookingId } = (req.body || {}) as CreatePaymentOrderBody;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('A valid bookingId is required.');
    }

    // 2. Find booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    // 3. Strict Devotee Ownership Check
    if (!booking.userId.equals(req.user.userId)) {
      throw ApiError.forbidden('You are not authorized to pay for this booking.');
    }

    // 4. Verify booking is not cancelled
    if (booking.bookingStatus === BOOKING_STATUS.CANCELLED) {
      throw ApiError.badRequest('Cannot process payment for a cancelled booking.');
    }

    // 5. Check if already PAID (Idempotency)
    if (booking.paymentStatus === PAYMENT_STATUS.PAID) {
      return ApiResponse.success(
        res,
        {
          bookingId: booking._id,
          bookingReference: booking.bookingReference,
          status: PAYMENT_STATUS.PAID,
          message: 'Booking is already paid and confirmed.',
        },
        'Booking has already been paid.'
      );
    }

    // 6. Calculate authoritative amount from MongoDB (Never trust frontend amount)
    const service = await Service.findById(booking.serviceId);
    if (!service || !service.isActive) {
      throw ApiError.notFound('Service associated with this booking is no longer active.');
    }

    const unitPrice = service.price || 0;
    const calculatedAmount = unitPrice * booking.quantity;

    if (calculatedAmount < 0) {
      throw ApiError.badRequest('Calculated amount cannot be negative.');
    }

    // 7. Check if an active PENDING payment with orderId already exists
    let existingPayment = await Payment.findOne({
      bookingId: booking._id,
      status: PAYMENT_STATUS.PENDING,
      provider: PAYMENT_PROVIDERS.RAZORPAY,
    });

    const keyId = process.env.RAZORPAY_KEY_ID || ENV.RAZORPAY?.KEY_ID;

    // Create a new Razorpay order
    const rzpOrder = await paymentService.createOrder({
      amount: calculatedAmount,
      currency: 'INR',
      receipt: booking.bookingReference,
      notes: {
        bookingId: booking._id.toString(),
        userId: req.user.userId.toString(),
        templeId: booking.templeId.toString(),
      },
    });

    // 8. Save or update Payment record
    if (existingPayment) {
      existingPayment.providerOrderId = rzpOrder.id;
      existingPayment.amount = calculatedAmount;
      existingPayment.currency = rzpOrder.currency;
      await existingPayment.save();
    } else {
      existingPayment = new Payment({
        bookingId: booking._id,
        userId: req.user.userId,
        templeId: booking.templeId,
        amount: calculatedAmount,
        currency: rzpOrder.currency || 'INR',
        provider: PAYMENT_PROVIDERS.RAZORPAY,
        providerOrderId: rzpOrder.id,
        status: PAYMENT_STATUS.PENDING,
      });
      await existingPayment.save();
    }

    // 9. Return safe client response (NEVER return secret)
    return ApiResponse.success(
      res,
      {
        orderId: rzpOrder.id,
        amount: rzpOrder.amount, // in paise
        currency: rzpOrder.currency,
        keyId,
        bookingReference: booking.bookingReference,
        bookingId: booking._id,
        totalAmount: calculatedAmount,
        devoteeName: booking.devotees?.[0]?.name || req.user.name,
        devoteeEmail: req.user.email,
        devoteePhone: '',
      },
      'Razorpay test order created successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Verify Razorpay Payment Signature
 * POST /api/payments/verify
 * Authenticated DEVOTEE only
 */
export const verifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    // 1. Authenticate user and verify DEVOTEE role
    if (!req.user || req.user.role !== 'DEVOTEE') {
      throw ApiError.forbidden('Only devotees can verify payment.');
    }

    const { bookingId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = (req.body || {}) as VerifyPaymentBody;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('A valid bookingId is required.');
    }
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      throw ApiError.badRequest('razorpayPaymentId, razorpayOrderId, and razorpaySignature are required.');
    }

    // 2. Find booking
    const booking = await Booking.findById(bookingId)
      .populate('templeId', 'name')
      .populate('serviceId', 'name');

    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    // 3. Strict Devotee Ownership Check
    if (!booking.userId.equals(req.user.userId)) {
      throw ApiError.forbidden('You are not authorized to verify this payment.');
    }

    // 4. Check if already confirmed (Idempotent success)
    if (
      booking.paymentStatus === PAYMENT_STATUS.PAID &&
      booking.bookingStatus === BOOKING_STATUS.CONFIRMED
    ) {
      return ApiResponse.success(
        res,
        {
          booking: booking.toMaskedJSON(),
          paymentStatus: PAYMENT_STATUS.PAID,
          bookingStatus: BOOKING_STATUS.CONFIRMED,
        },
        'Payment was already verified and confirmed.'
      );
    }

    // 5. Server-Side Signature Verification using RAZORPAY_KEY_SECRET
    const isValidSignature = paymentService.verifySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValidSignature) {
      // Record failed transaction attempt
      await Payment.findOneAndUpdate(
        { bookingId: booking._id, providerOrderId: razorpayOrderId },
        {
          status: PAYMENT_STATUS.FAILED,
          failureReason: 'Invalid Razorpay signature verification',
        }
      );

      logger.warn(`[PaymentController] Invalid signature detected for booking: ${booking.bookingReference}`);
      throw ApiError.badRequest('Payment verification failed. Invalid transaction signature.');
    }

    // 6. Update Payment Record to PAID
    let payment = await Payment.findOne({
      bookingId: booking._id,
      providerOrderId: razorpayOrderId,
    });

    if (!payment) {
      payment = await Payment.findOne({ bookingId: booking._id });
    }

    if (payment) {
      payment.status = PAYMENT_STATUS.PAID;
      payment.providerPaymentId = razorpayPaymentId;
      payment.providerOrderId = razorpayOrderId;
      payment.failureReason = undefined;
      await payment.save();
    } else {
      const populatedTemple = booking.templeId as unknown as { _id?: mongoose.Types.ObjectId };
      payment = new Payment({
        bookingId: booking._id,
        userId: req.user.userId,
        templeId: populatedTemple?._id || booking.templeId,
        amount: booking.totalAmount,
        currency: 'INR',
        provider: PAYMENT_PROVIDERS.RAZORPAY,
        providerOrderId: razorpayOrderId,
        providerPaymentId: razorpayPaymentId,
        status: PAYMENT_STATUS.PAID,
      });
      await payment.save();
    }

    // 7. Update Booking Record to PAID & CONFIRMED
    booking.paymentStatus = PAYMENT_STATUS.PAID;
    booking.bookingStatus = BOOKING_STATUS.CONFIRMED;

    // Generate secure cryptographic verification token if not present (Idempotent)
    if (!booking.qrVerificationToken) {
      const qrCodeToken = booking.qrCode?.code || crypto.randomBytes(24).toString('hex');
      booking.qrVerificationToken = qrCodeToken;
      booking.qrCode = {
        code: qrCodeToken,
        generatedAt: booking.qrCode?.generatedAt || new Date(),
      };
    } else if (!booking.qrCode?.code) {
      booking.qrCode = {
        code: booking.qrVerificationToken,
        generatedAt: new Date(),
      };
    }

    await booking.save();

    // 8. Create Devotee Notification ONLY after successful verification
    const populatedTemple = booking.templeId as unknown as { name?: string; _id?: mongoose.Types.ObjectId };
    const populatedService = booking.serviceId as unknown as { name?: string; _id?: mongoose.Types.ObjectId };
    const templeName = populatedTemple?.name || 'Temple';
    const serviceName = populatedService?.name || 'Darshan Seva';
    const formattedDate = new Date(booking.bookingDate).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    try {
      await Notification.create({
        userId: req.user.userId,
        title: 'Booking Confirmed',
        message: `Your booking at ${templeName} for ${serviceName} on ${formattedDate} has been confirmed.`,
        type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        metadata: {
          bookingId: booking._id,
          templeId: populatedTemple?._id || booking.templeId,
          serviceId: populatedService?._id || booking.serviceId,
          actionUrl: `/my-bookings/${booking._id}`,
        },
      });
    } catch (notifErr: unknown) {
      const err = notifErr as { message?: string };
      logger.warn(`[PaymentController] Devotee confirmed notification failed: ${err.message || 'Unknown'}`);
    }

    logger.info(
      `[PaymentController] Payment successfully verified: ${booking.bookingReference} (Razorpay: ${razorpayPaymentId})`
    );

    return ApiResponse.success(
      res,
      {
        booking: booking.toMaskedJSON(),
        payment: {
          id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          providerPaymentId: payment.providerPaymentId,
          providerOrderId: payment.providerOrderId,
        },
      },
      'Payment verified successfully and booking confirmed.'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Get Payment Details by Booking ID
 * GET /api/payments/booking/:bookingId
 */
export const getPaymentByBookingId = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const { bookingId } = req.params;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('A valid bookingId is required.');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    // Role-based access check
    if (req.user.role === 'DEVOTEE') {
      if (!booking.userId.equals(req.user.userId)) {
        throw ApiError.forbidden('Access denied to this payment record.');
      }
    } else if (req.user.role === 'TEMPLE_AUTHORITY') {
      if (!req.user.templeId || !booking.templeId.equals(req.user.templeId)) {
        throw ApiError.forbidden('Access denied to this payment record.');
      }
    }

    const payment = await Payment.findOne({ bookingId: booking._id })
      .select('-__v')
      .lean();

    if (!payment) {
      return ApiResponse.success(res, null, 'No payment record found for this booking.');
    }

    return ApiResponse.success(res, payment, 'Payment record retrieved successfully.');
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  createPaymentOrder,
  verifyPayment,
  getPaymentByBookingId,
};
