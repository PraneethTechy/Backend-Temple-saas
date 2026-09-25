import crypto from 'crypto';
import mongoose from 'mongoose';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

/**
 * Generates a high-entropy, human-readable unique booking reference
 * Format: DVS-YYYYMMDD-XXXXXX
 */
const generateBookingReference = async (bookingDate) => {
  const dateObj = new Date(bookingDate);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidateRef = `DVS-${dateStr}-${randomSuffix}`;
    const exists = await Booking.findOne({ bookingReference: candidateRef });
    if (!exists) {
      return candidateRef;
    }
  }

  // Fallback high-entropy timestamp suffix
  return `DVS-${dateStr}-${Date.now().toString(36).toUpperCase()}`;
};

/**
 * Create Devotee Booking (Phase 7 - Devotee Booking Engine)
 * POST /api/bookings
 * Authenticated DEVOTEE only
 */
export const createBooking = async (req, res, next) => {
  let capacityReserved = false;

  try {
    // 1. Enforce DEVOTEE role check
    if (!req.user || req.user.role !== 'DEVOTEE') {
      throw ApiError.forbidden('Only authenticated devotees are authorized to create bookings.');
    }

    const {
      templeId,
      serviceId,
      timeSlotId,
      bookingDate,
      devotees,
    } = req.body || {};

    // 2. Validate IDs
    if (!templeId || !mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('A valid templeId is required.');
    }
    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      throw ApiError.badRequest('A valid serviceId is required.');
    }
    if (!timeSlotId || !mongoose.Types.ObjectId.isValid(timeSlotId)) {
      throw ApiError.badRequest('A valid timeSlotId is required.');
    }

    // 3. Validate Devotees Array & Quantity
    if (!Array.isArray(devotees) || devotees.length === 0) {
      throw ApiError.badRequest('At least one devotee must be provided.');
    }
    const MAX_DEVOTEES_PER_BOOKING = 6;
    if (devotees.length > MAX_DEVOTEES_PER_BOOKING) {
      throw ApiError.badRequest(`A maximum of ${MAX_DEVOTEES_PER_BOOKING} devotees is permitted per booking.`);
    }

    const quantity = devotees.length;

    // Validate individual devotee details
    const sanitizedDevotees = devotees.map((dev, idx) => {
      const name = dev.name?.trim();
      const age = parseInt(dev.age, 10);
      const gender = dev.gender?.toUpperCase()?.trim();
      const idType = dev.idType ? dev.idType.toUpperCase().trim() : 'OTHER';
      const idNumber = dev.idNumber ? String(dev.idNumber).trim() : '';

      if (!name || name.length < 2) {
        throw ApiError.badRequest(`Devotee #${idx + 1}: Name is required and must be at least 2 characters.`);
      }
      if (isNaN(age) || age < 0 || age > 120) {
        throw ApiError.badRequest(`Devotee #${idx + 1}: Age must be a valid number between 0 and 120.`);
      }
      if (!['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
        throw ApiError.badRequest(`Devotee #${idx + 1}: Gender must be MALE, FEMALE, or OTHER.`);
      }
      if (!['AADHAAR', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'OTHER'].includes(idType)) {
        throw ApiError.badRequest(`Devotee #${idx + 1}: Invalid idType.`);
      }

      return {
        name,
        age,
        gender,
        idType,
        idNumber,
      };
    });

    // 4. Validate Booking Date
    if (!bookingDate) {
      throw ApiError.badRequest('bookingDate is required.');
    }
    const parsedDate = new Date(bookingDate);
    if (isNaN(parsedDate.getTime())) {
      throw ApiError.badRequest('Invalid bookingDate format. Use YYYY-MM-DD.');
    }

    // Normalize calendar day
    const normalizedBookingDate = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    );
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (normalizedBookingDate.getTime() < todayStart.getTime()) {
      throw ApiError.badRequest('Booking date cannot be in the past.');
    }

    // 5. Verify Temple Exists & is ACTIVE
    const temple = await Temple.findById(templeId);
    if (!temple || temple.status !== TEMPLE_STATUS.ACTIVE) {
      throw ApiError.notFound('Temple not found or is currently not active for public bookings.');
    }

    // 6. Verify Service Exists, Belongs to Temple & is Active
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive || !service.templeId.equals(templeId)) {
      throw ApiError.notFound('Requested service not found or does not belong to this active temple.');
    }

    // 7. Verify TimeSlot Exists, Belongs to Temple & Service, and is Active
    const timeSlot = await TimeSlot.findById(timeSlotId);
    if (
      !timeSlot ||
      !timeSlot.isActive ||
      !timeSlot.templeId.equals(templeId) ||
      !timeSlot.serviceId.equals(serviceId)
    ) {
      throw ApiError.notFound('Requested time slot not found or does not match temple and service.');
    }

    // 8. Validate Date Range & Weekday Match on TimeSlot
    if (!timeSlot.isAvailableForDate(normalizedBookingDate)) {
      throw ApiError.badRequest(
        'The requested slot is not available on this calendar date or weekday.'
      );
    }

    // 9. Authoritative Backend Price Calculation (Never trust frontend price/totalAmount)
    const unitPrice = service.price || 0;
    const totalAmount = unitPrice * quantity;

    // 10. CRITICAL: Atomic Capacity Reservation
    // Atomically increment bookedCount ONLY IF bookedCount <= capacity - quantity
    const updatedSlot = await TimeSlot.findOneAndUpdate(
      {
        _id: timeSlotId,
        templeId,
        serviceId,
        isActive: true,
        bookedCount: { $lte: timeSlot.capacity - quantity },
      },
      {
        $inc: { bookedCount: quantity },
      },
      {
        new: true,
      }
    );

    if (!updatedSlot) {
      throw ApiError.conflict('Not enough seats available for this slot.');
    }

    capacityReserved = true;

    // 11. Generate unique human-readable booking reference
    const bookingReference = await generateBookingReference(normalizedBookingDate);

    // Free Offering auto-confirmation logic
    const isFreeBooking = totalAmount === 0;
    const initialPaymentStatus = isFreeBooking ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
    const initialBookingStatus = isFreeBooking ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.PENDING;
    const initialToken = isFreeBooking ? crypto.randomBytes(24).toString('hex') : null;

    // 12. Create Booking Document
    const booking = new Booking({
      bookingReference,
      userId: req.user.userId,
      templeId,
      serviceId,
      timeSlotId,
      bookingDate: normalizedBookingDate,
      devotees: sanitizedDevotees,
      quantity,
      totalAmount,
      paymentStatus: initialPaymentStatus,
      bookingStatus: initialBookingStatus,
      qrVerificationToken: initialToken,
      qrCode: {
        code: initialToken,
        generatedAt: isFreeBooking ? new Date() : null,
      },
      checkedInAt: null,
      checkedInBy: null,
      completedAt: null,
    });

    await booking.save();

    // 14. Dispatch Notifications (Async / Best effort)
    // Devotee notification: sent immediately if already confirmed (e.g. free service); otherwise sent upon payment verification
    if (booking.bookingStatus === BOOKING_STATUS.CONFIRMED) {
      Notification.create({
        userId: req.user.userId,
        title: 'Booking Confirmed',
        message: `Your booking request ${bookingReference} for ${service.name} at ${temple.name} has been confirmed.`,
        type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        metadata: {
          bookingId: booking._id,
          templeId: temple._id,
          serviceId: service._id,
          actionUrl: `/my-bookings/${booking._id}`,
        },
      }).catch((notifErr) => logger.warn(`[BookingController] Devotee notification failed: ${notifErr.message}`));
    }

    // Temple Authority Notification (if temple has assigned authority)
    if (temple.authorityId) {
      Notification.create({
        userId: temple.authorityId,
        title: 'New Devotee Booking Received',
        message: `New booking request ${bookingReference} received for ${service.name} (${quantity} devotee${quantity > 1 ? 's' : ''}).`,
        type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        metadata: {
          bookingId: booking._id,
          templeId: temple._id,
          serviceId: service._id,
          actionUrl: '/authority/bookings',
        },
      }).catch((notifErr) => logger.warn(`[BookingController] Authority notification failed: ${notifErr.message}`));
    }

    // Return created booking with masked devotee IDs
    const maskedBooking = booking.toMaskedJSON();

    return ApiResponse.created(
      res,
      {
        booking: maskedBooking,
        temple: {
          name: temple.name,
          city: temple.city,
          state: temple.state,
          slug: temple.slug,
        },
        service: {
          name: service.name,
          type: service.type,
          price: service.price,
          duration: service.duration,
        },
        timeSlot: {
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
        },
      },
      'Booking created successfully.'
    );
  } catch (error) {
    // Rollback / Compensation on failure
    if (capacityReserved) {
      logger.info('[BookingController] Rolling back reserved slot capacity due to booking error...');
      await TimeSlot.updateOne(
        { _id: req.body?.timeSlotId },
        { $inc: { bookedCount: -(req.body?.devotees?.length || 1) } }
      ).catch((rollErr) => logger.error(`[BookingController] Capacity rollback failed: ${rollErr.message}`));
    }

    next(error);
  }
};

/**
 * Get Authenticated Devotee Bookings
 * GET /api/bookings/my
 * Authenticated DEVOTEE only
 */
export const getMyBookings = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'DEVOTEE') {
      throw ApiError.forbidden('Only devotees can access devotee bookings.');
    }

    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const { status, date } = req.query;

    const query = { userId };

    if (status && status.toUpperCase() !== 'ALL') {
      query.bookingStatus = status.toUpperCase();
    }

    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        query.bookingDate = { $gte: startOfDay, $lte: endOfDay };
      }
    }

    const [total, rawBookings] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .populate('templeId', 'name city state coverImage slug')
        .populate('serviceId', 'name type price duration')
        .populate('timeSlotId', 'startTime endTime')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const bookings = rawBookings.map((b) => b.toMaskedJSON());

    return ApiResponse.success(
      res,
      {
        bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'My bookings retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Booking By ID
 * GET /api/bookings/:id
 * Authenticated DEVOTEE only (Enforces Ownership)
 */
export const getBookingById = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'DEVOTEE') {
      throw ApiError.forbidden('Only devotees can access devotee bookings.');
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid booking ID.');
    }

    const booking = await Booking.findById(id)
      .populate('templeId', 'name city state address pincode description coverImage timings phone email slug')
      .populate('serviceId', 'name type price duration description rules')
      .populate('timeSlotId', 'startTime endTime capacity');

    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    // Strict ownership verification
    if (!booking.userId.equals(req.user.userId)) {
      throw ApiError.notFound('Booking not found.');
    }

    // Idempotent QR token generation for confirmed & paid bookings
    if (
      booking.bookingStatus === BOOKING_STATUS.CONFIRMED &&
      booking.paymentStatus === PAYMENT_STATUS.PAID &&
      !booking.qrVerificationToken
    ) {
      const stableToken = booking.qrCode?.code || crypto.randomBytes(24).toString('hex');
      booking.qrVerificationToken = stableToken;
      if (!booking.qrCode?.code) {
        booking.qrCode = { code: stableToken, generatedAt: new Date() };
      }
      await booking.save();
    }

    return ApiResponse.success(res, booking.toMaskedJSON(), 'Booking details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Booking
 * PATCH /api/bookings/:id/cancel
 * Authenticated DEVOTEE only (Enforces Ownership & Atomic Capacity Restoration)
 */
export const cancelBooking = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'DEVOTEE') {
      throw ApiError.forbidden('Only devotees can cancel devotee bookings.');
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid booking ID.');
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    // Strict ownership verification
    if (!booking.userId.equals(req.user.userId)) {
      throw ApiError.notFound('Booking not found.');
    }

    // Only allow cancellation if currently PENDING
    if (booking.bookingStatus === BOOKING_STATUS.CANCELLED) {
      throw ApiError.conflict('Booking is already cancelled.');
    }

    if (booking.bookingStatus !== BOOKING_STATUS.PENDING) {
      throw ApiError.badRequest(`Cannot cancel booking with status: ${booking.bookingStatus}.`);
    }

    // Update status to CANCELLED
    booking.bookingStatus = BOOKING_STATUS.CANCELLED;
    await booking.save();

    // Atomically restore capacity on the associated TimeSlot
    // Guard: only decrement if bookedCount >= booking.quantity
    await TimeSlot.findOneAndUpdate(
      {
        _id: booking.timeSlotId,
        bookedCount: { $gte: booking.quantity },
      },
      {
        $inc: { bookedCount: -booking.quantity },
      }
    );

    // Create cancellation notification
    Notification.create({
      userId: req.user.userId,
      title: 'Booking Cancelled',
      message: `Your booking ${booking.bookingReference} has been cancelled successfully.`,
      type: NOTIFICATION_TYPES.BOOKING_CANCELLED,
      metadata: {
        bookingId: booking._id,
        templeId: booking.templeId,
        serviceId: booking.serviceId,
        actionUrl: `/my-bookings/${booking._id}`,
      },
    }).catch(() => {});

    return ApiResponse.success(
      res,
      booking.toMaskedJSON(),
      'Booking cancelled successfully and capacity restored.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Public Booking QR Verification
 * GET /api/bookings/verify/:token
 * Unauthenticated / Public Gate Verification Endpoint
 */
export const verifyBookingByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string' || token.trim().length < 8) {
      return ApiResponse.success(res, {
        valid: false,
        message: 'Invalid verification token format.',
      });
    }

    const cleanToken = token.trim();
    const booking = await Booking.findOne({
      $or: [{ qrVerificationToken: cleanToken }, { 'qrCode.code': cleanToken }],
    })
      .populate('templeId', 'name city state')
      .populate('serviceId', 'name type')
      .populate('timeSlotId', 'startTime endTime');

    if (!booking) {
      return ApiResponse.success(res, {
        valid: false,
        message: 'This booking could not be verified. No record found.',
      });
    }

    // Gate validation: Only CONFIRMED bookings with PAID payment status are valid
    const isValidStatus =
      booking.bookingStatus === BOOKING_STATUS.CONFIRMED &&
      booking.paymentStatus === PAYMENT_STATUS.PAID;

    if (!isValidStatus) {
      let reason = 'This booking could not be verified or is no longer valid.';
      if (booking.bookingStatus === BOOKING_STATUS.CANCELLED) {
        reason = 'This booking has been cancelled and cannot be used for entry.';
      } else if (booking.bookingStatus === BOOKING_STATUS.CHECKED_IN) {
        reason = 'This ticket has already been used for gate entry.';
      } else if (booking.paymentStatus !== PAYMENT_STATUS.PAID) {
        reason = 'This booking payment has not been completed.';
      }

      return ApiResponse.success(res, {
        valid: false,
        message: reason,
        bookingReference: booking.bookingReference,
        status: booking.bookingStatus,
      });
    }

    // Format safe response (NO Devotee PII: no names, email, phone, ID numbers, or payment secrets)
    const bookingDateStr = new Date(booking.bookingDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const bookingTimeStr = booking.timeSlotId
      ? `${booking.timeSlotId.startTime}${booking.timeSlotId.endTime ? ` – ${booking.timeSlotId.endTime}` : ''}`
      : 'As per schedule';

    return ApiResponse.success(
      res,
      {
        valid: true,
        bookingReference: booking.bookingReference,
        templeName: booking.templeId?.name || 'Temple',
        templeCity: booking.templeId?.city || '',
        templeState: booking.templeId?.state || '',
        serviceName: booking.serviceId?.name || 'Darshan Seva',
        serviceType: booking.serviceId?.type || 'DARSHAN',
        bookingDate: bookingDateStr,
        bookingTime: bookingTimeStr,
        quantity: booking.quantity,
        status: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        verifiedAt: new Date().toISOString(),
      },
      'Booking verified successfully.'
    );
  } catch (error) {
    next(error);
  }
};

export default {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  verifyBookingByToken,
};
