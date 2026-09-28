import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Review, REVIEW_STATUS } from '../models/Review.js';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { uploadImageBufferToCloudinary, deleteImageFromCloudinary } from '../services/cloudinaryService.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

interface SubmitReviewBody {
  bookingId?: string;
  rating?: number | string;
  comment?: string;
}

interface PublicReviewsQuery {
  page?: string;
  limit?: string;
  sort?: string;
  templeId?: string;
}

/**
 * Public Endpoint: Get Approved Devotee Reviews
 * GET /api/reviews
 *
 * Query Params:
 * - page: number (default 1)
 * - limit: number (default 12)
 * - sort: 'recent' | 'rating' (default 'recent')
 * - templeId: ObjectId | slug (optional)
 */
export const getPublicReviews = async (
  req: Request<Record<string, never>, unknown, unknown, PublicReviewsQuery>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const skip = (page - 1) * limit;
    const { sort, templeId } = req.query;

    let query: Record<string, unknown> = {
      status: REVIEW_STATUS.APPROVED,
    };

    // If an authenticated devotee is browsing, show all approved reviews plus their own reviews (even if PENDING)
    if (req.user?.userId) {
      query = {
        $or: [
          { status: REVIEW_STATUS.APPROVED },
          { userId: req.user.userId },
        ],
      };
    }

    // Filter by temple if provided
    if (templeId) {
      let targetTempleId: mongoose.Types.ObjectId | string | null = null;
      if (mongoose.Types.ObjectId.isValid(templeId)) {
        targetTempleId = templeId;
      } else {
        const foundTemple = await Temple.findOne({
          slug: templeId.toLowerCase(),
          status: TEMPLE_STATUS.ACTIVE,
        })
          .select('_id')
          .lean();

        if (foundTemple) {
          targetTempleId = foundTemple._id as mongoose.Types.ObjectId;
        }
      }

      if (targetTempleId) {
        if (query.$or) {
          query = {
            $and: [
              { templeId: targetTempleId },
              { $or: query.$or },
            ],
          };
        } else {
          query.templeId = targetTempleId;
        }
      }
    }

    // Sort order
    let sortOptions: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'rating') {
      sortOptions = { rating: -1, createdAt: -1 };
    }

    const [total, reviews] = await Promise.all([
      Review.countDocuments(query),
      Review.find(query)
        .populate('userId', 'name')
        .populate('templeId', 'name city state slug coverImage')
        .populate('bookingId', 'bookingReference bookingDate')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const formattedReviews = reviews.map((r: any) => {
      const devoteeName = r.userId?.name || 'Devotee';
      const isOwnReview = req.user?.userId
        ? (r.userId?._id?.toString() === req.user.userId.toString() ||
           r.userId?.toString() === req.user.userId.toString())
        : false;

      return {
        _id: r._id,
        name: devoteeName,
        rating: r.rating,
        comment: r.comment,
        photos: r.photos || [],
        templeName: r.templeId?.name || 'Sacred Temple',
        templeCity: r.templeId?.city || '',
        templeSlug: r.templeId?.slug || '',
        date: new Date(r.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        createdAt: r.createdAt,
        bookingReference: r.bookingId?.bookingReference || null,
        isDemo: r.isDemo || false,
        status: r.status,
        isOwnReview,
      };
    });

    return ApiResponse.success(
      res,
      {
        reviews: formattedReviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Devotee reviews retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Authenticated Devotee: Get Eligible Bookings for Review
 * GET /api/reviews/eligible-bookings
 */
export const getDevoteeEligibleBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const userId = req.user.userId;

    // Find confirmed, checked-in, or completed paid bookings
    const bookings = await Booking.find({
      userId,
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: {
        $in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.COMPLETED],
      },
    })
      .populate('templeId', 'name city state coverImage slug')
      .populate('serviceId', 'name')
      .populate('timeSlotId', 'startTime endTime')
      .sort({ bookingDate: -1, createdAt: -1 })
      .lean();

    if (!bookings.length) {
      return ApiResponse.success(
        res,
        { eligibleBookings: [] },
        'No eligible bookings found for review.'
      );
    }

    const bookingIds = bookings.map((b) => b._id);

    // Check which bookings already have a review
    const existingReviews = await Review.find({
      userId,
      bookingId: { $in: bookingIds },
    })
      .select('bookingId rating comment status createdAt')
      .lean();

    const reviewMap = new Map();
    existingReviews.forEach((rev) => {
      if (rev.bookingId) {
        reviewMap.set(rev.bookingId.toString(), rev);
      }
    });

    const eligibleBookings = bookings.map((b) => {
      const rev = reviewMap.get(b._id.toString()) || null;
      return {
        _id: b._id,
        bookingReference: b.bookingReference,
        bookingDate: b.bookingDate,
        temple: b.templeId,
        service: b.serviceId,
        timeSlot: b.timeSlotId,
        hasReview: Boolean(rev),
        existingReview: rev,
      };
    });

    return ApiResponse.success(
      res,
      { eligibleBookings },
      'Eligible bookings retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Authenticated Devotee: Submit a New Review with Photos
 * POST /api/reviews
 */
export const submitDevoteeReview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  const uploadedCloudinaryAssets: string[] = [];
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const userId = req.user.userId;
    const { bookingId, rating, comment } = req.body as SubmitReviewBody;

    // 1. Validate booking ID
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('A valid booking must be selected to share your experience.');
    }

    // 2. Validate rating
    const numRating = Number(rating);
    if (!numRating || isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw ApiError.badRequest('Please provide a star rating between 1 and 5.');
    }

    // 3. Validate comment
    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      throw ApiError.badRequest('Please write a brief reflection on your temple experience.');
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length < 3) {
      throw ApiError.badRequest('Review must be at least 3 characters.');
    }
    if (trimmedComment.length > 500) {
      throw ApiError.badRequest('Review comment cannot exceed 500 characters.');
    }

    // 4. Verify booking ownership and eligibility
    const booking = await Booking.findById(bookingId).populate('templeId', 'name status');
    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    if (!booking.userId.equals(userId)) {
      throw ApiError.forbidden('You are not authorized to submit a review for this booking.');
    }

    if (booking.paymentStatus !== PAYMENT_STATUS.PAID) {
      throw ApiError.badRequest('Only paid visits can be reviewed.');
    }

    const eligibleStatuses: string[] = [
      BOOKING_STATUS.CONFIRMED,
      BOOKING_STATUS.CHECKED_IN,
      BOOKING_STATUS.COMPLETED,
    ];
    if (!eligibleStatuses.includes(booking.bookingStatus)) {
      throw ApiError.badRequest('This booking is not eligible for review.');
    }

    // 5. Duplicate Protection: Check if user already reviewed this booking
    const existingReview = await Review.findOne({ userId, bookingId });
    if (existingReview) {
      throw ApiError.badRequest("You've already shared your experience for this visit.");
    }

    // 6. Handle Photo Uploads (Max 5 photos)
    const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    if (files.length > 5) {
      throw ApiError.badRequest('You can upload a maximum of 5 photos.');
    }

    const photos = [];
    const populatedTemple = booking.templeId as unknown as { name?: string; _id?: mongoose.Types.ObjectId };
    for (const file of files) {
      const uploadRes = await uploadImageBufferToCloudinary(file.buffer, 'devasetu/reviews');
      uploadedCloudinaryAssets.push(uploadRes.publicId);
      photos.push({
        url: uploadRes.url,
        publicId: uploadRes.publicId,
        alt: `${populatedTemple?.name || 'Temple'} devotee experience photo`,
      });
    }

    // 7. Create Review in PENDING status (requires admin moderation)
    const newReview = await Review.create({
      userId,
      templeId: populatedTemple?._id || booking.templeId,
      bookingId: booking._id,
      rating: numRating,
      comment: trimmedComment,
      photos,
      status: REVIEW_STATUS.PENDING,
      isDemo: false,
    });

    logger.info(`[Review]: Devotee ${userId} submitted review for booking ${booking.bookingReference}`);

    return ApiResponse.created(
      res,
      { review: newReview },
      'Thank you for sharing your experience 🙏. Your review has been submitted and will appear after approval.'
    );
  } catch (error: unknown) {
    // Clean up uploaded Cloudinary images if database insertion fails
    if (uploadedCloudinaryAssets.length > 0) {
      Promise.all(
        uploadedCloudinaryAssets.map((pubId) =>
          deleteImageFromCloudinary(pubId).catch(() => {})
        )
      ).catch(() => {});
    }
    next(error);
  }
};

export default {
  getPublicReviews,
  getDevoteeEligibleBookings,
  submitDevoteeReview,
};
