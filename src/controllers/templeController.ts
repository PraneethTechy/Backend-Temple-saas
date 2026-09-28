import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { TempleCategory } from '../models/TempleCategory.js';
import { Service } from '../models/Service.js';
import { TimeSlot } from '../models/TimeSlot.js';
import { TempleAnnouncement } from '../models/TempleAnnouncement.js';
import { Review, REVIEW_STATUS } from '../models/Review.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

interface PublicTemplesQuery {
  page?: string;
  limit?: string;
  search?: string;
  city?: string;
  state?: string;
  templeType?: string;
  sort?: string;
  category?: string;
  serviceType?: string;
}

interface PublicAvailabilityQuery {
  date?: string;
  month?: string;
}

/**
 * Public Temple Discovery & Search
 * GET /api/temples
 * Filters strictly for status = ACTIVE.
 */
export const getPublicTemples = async (
  req: Request<Record<string, never>, unknown, unknown, PublicTemplesQuery>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const skip = (page - 1) * limit;

    const { search, city, state, templeType, sort, category, serviceType } = req.query;

    // Strictly enforce active temples only
    const filter: Record<string, unknown> = { status: TEMPLE_STATUS.ACTIVE };

    // Filter by Service Types (e.g. DARSHAN or POOJA,SEVA)
    if (serviceType && serviceType.trim()) {
      const types = serviceType
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);

      if (types.length > 0) {
        const matchingTempleIds = await Service.distinct('templeId', {
          type: { $in: types },
          isActive: true,
        });

        if (matchingTempleIds.length === 0) {
          return ApiResponse.success(
            res,
            {
              items: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
              },
            },
            'No active temples found offering the specified services'
          );
        }

        filter._id = { $in: matchingTempleIds };
      }
    }

    // Filter by Category Slug or ID
    if (category && category.trim()) {
      const catSlug = category.trim().toLowerCase();
      const queryCat = mongoose.Types.ObjectId.isValid(catSlug)
        ? { $or: [{ slug: catSlug }, { _id: catSlug }] }
        : { slug: catSlug };

      const categoryDoc = await TempleCategory.findOne({
        ...queryCat,
        isActive: true,
      }).select('_id');

      if (categoryDoc) {
        filter.categories = categoryDoc._id;
      } else {
        return ApiResponse.success(
          res,
          {
            items: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
            },
          },
          'No active temples found for the specified category'
        );
      }
    }

    // Search query matches name, city, state, or templeType
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { city: regex },
        { state: regex },
        { templeType: regex },
      ];
    }

    if (city && city.trim()) {
      filter.city = new RegExp(`^${city.trim()}$`, 'i');
    }

    if (state && state.trim()) {
      filter.state = new RegExp(`^${state.trim()}$`, 'i');
    }

    if (templeType && templeType.trim() && templeType.toUpperCase() !== 'ALL') {
      filter.templeType = new RegExp(`^${templeType.trim()}$`, 'i');
    }

    // Sort options
    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'name_asc') {
      sortOption = { name: 1 };
    } else if (sort === 'name_desc') {
      sortOption = { name: -1 };
    } else if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    }

    const [temples, total] = await Promise.all([
      Temple.find(filter)
        .select('name slug templeType address city state pincode description coverImage timings gallery categories createdAt latitude longitude mapUrl')
        .populate('categories', 'name slug')
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Temple.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return ApiResponse.success(
      res,
      {
        items: temples || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      'Active temples retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Public Temple Details by Slug
 * GET /api/temples/:slug
 * Strictly enforces status = ACTIVE and excludes sensitive internal fields.
 */
export const getPublicTempleBySlug = async (
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { slug } = req.params;

    if (!slug) {
      throw ApiError.badRequest('Temple identifier or slug is required');
    }

    const query: Record<string, unknown> = {
      status: TEMPLE_STATUS.ACTIVE,
      $or: [
        { slug: slug.toLowerCase() },
      ],
    };

    if (mongoose.Types.ObjectId.isValid(slug)) {
      (query.$or as unknown[]).push({ _id: slug });
    }

    const temple = await Temple.findOne(query)
      .populate('categories', 'name slug description displayOrder')
      .select('-authorityId -__v')
      .lean();

    if (!temple) {
      throw ApiError.notFound('Temple not found or is currently not active on the platform');
    }

    return ApiResponse.success(res, temple, 'Temple details retrieved successfully');
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Public Service Discovery for an Active Temple
 * GET /api/temples/:templeId/services
 * Strictly returns only active services for an active temple.
 */
export const getPublicTempleServices = async (
  req: Request<{ templeId: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId } = req.params;

    if (!templeId || !mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID format');
    }

    // 1. Verify temple is ACTIVE
    const temple = await Temple.findOne({
      _id: templeId,
      status: TEMPLE_STATUS.ACTIVE,
    }).lean();

    if (!temple) {
      throw ApiError.notFound('Temple not found or is currently not active');
    }

    // 2. Fetch active services for this active temple only
    const services = await Service.find({
      templeId: temple._id,
      isActive: true,
    })
      .select('name type description price duration availableDays rules image isActive')
      .sort({ price: 1, name: 1 })
      .lean();

    return ApiResponse.success(res, services, 'Active temple services retrieved successfully');
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Public Availability Discovery (Read-Only)
 * GET /api/temples/:templeId/services/:serviceId/availability?date=YYYY-MM-DD
 * GET /api/temples/:templeId/services/:serviceId/availability?month=YYYY-MM
 * Discovers available slots for a specific date or an entire month across configured date ranges.
 */
export const getPublicServiceAvailability = async (
  req: Request<{ templeId: string; serviceId: string }, unknown, unknown, PublicAvailabilityQuery>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId, serviceId } = req.params;
    const { date, month } = req.query;

    if (!templeId || !mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID format');
    }

    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      throw ApiError.badRequest('Invalid service ID format');
    }

    if (!date && !month) {
      throw ApiError.badRequest('A query parameter "date" (format: YYYY-MM-DD) or "month" (format: YYYY-MM) is required');
    }

    // 1. Verify temple exists and is ACTIVE
    const temple = await Temple.findOne({
      _id: templeId,
      status: TEMPLE_STATUS.ACTIVE,
    }).lean();

    if (!temple) {
      throw ApiError.notFound('Temple not found or is currently not active');
    }

    // 2. Verify service belongs to that temple AND is ACTIVE
    const service = await Service.findOne({
      _id: serviceId,
      templeId: temple._id,
      isActive: true,
    }).lean();

    if (!service) {
      throw ApiError.notFound('Service not found, is inactive, or does not belong to this temple');
    }

    const weekdayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
    type Weekday = typeof weekdayNames[number];

    // CASE A: Monthly Availability Discovery (for Booking Calendar)
    if (month && !date) {
      const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
      if (!monthRegex.test(month)) {
        throw ApiError.badRequest('Invalid month format. Please supply a valid month (e.g. 2026-09)');
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthIndex = parseInt(monthStr, 10) - 1;

      const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      const candidateSlots = await TimeSlot.find({
        templeId: temple._id,
        serviceId: service._id,
        isActive: true,
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      })
        .sort({ startTime: 1 })
        .lean();

      const monthDays = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStart = new Date(year, monthIndex, d, 0, 0, 0, 0);
        const weekday = weekdayNames[new Date(year, monthIndex, d, 12, 0, 0).getDay()];
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        let totalSlots = 0;
        let availableSlots = 0;

        for (const slot of candidateSlots) {
          const sStart = new Date(slot.startDate);
          const sEnd = new Date(slot.endDate);
          const sStartTime = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate(), 0, 0, 0, 0).getTime();
          const sEndTime = new Date(sEnd.getFullYear(), sEnd.getMonth(), sEnd.getDate(), 23, 59, 59, 999).getTime();
          const currTime = dayStart.getTime();

          if (currTime >= sStartTime && currTime <= sEndTime) {
            let isDayMatch = true;
            if (Array.isArray(slot.availableDays) && slot.availableDays.length > 0) {
              isDayMatch = (slot.availableDays as Weekday[]).includes(weekday as Weekday);
            }

            if (isDayMatch) {
              totalSlots++;
              const capacity = slot.capacity || 0;
              const bookedCount = slot.bookedCount || 0;
              if (capacity > bookedCount) {
                availableSlots++;
              }
            }
          }
        }

        monthDays.push({
          date: dateStr,
          isAvailable: availableSlots > 0,
          availableSlotsCount: availableSlots,
          totalSlotsCount: totalSlots,
        });
      }

      return ApiResponse.success(
        res,
        {
          month,
          days: monthDays,
        },
        'Monthly service availability retrieved successfully'
      );
    }

    // CASE B: Single Date TimeSlot Query (for Time Slots List)
    let year: number;
    let monthIndex: number;
    let day: number;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      year = y;
      monthIndex = m - 1;
      day = d;
    } else {
      const requestedDate = new Date(date as string);
      if (isNaN(requestedDate.getTime())) {
        throw ApiError.badRequest('Invalid date format. Please supply a valid date (e.g. 2026-10-05)');
      }
      year = requestedDate.getFullYear();
      monthIndex = requestedDate.getMonth();
      day = requestedDate.getDate();
    }

    const dayStart = new Date(year, monthIndex, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, monthIndex, day, 23, 59, 59, 999);
    const requestedWeekday = weekdayNames[new Date(year, monthIndex, day, 12, 0, 0).getDay()];

    const candidateSlots = await TimeSlot.find({
      templeId: temple._id,
      serviceId: service._id,
      isActive: true,
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    })
      .sort({ startTime: 1 })
      .lean();

    const matchingSlots = [];

    for (const slot of candidateSlots) {
      const sStart = new Date(slot.startDate);
      const sEnd = new Date(slot.endDate);
      const sStartTime = new Date(sStart.getFullYear(), sStart.getMonth(), sStart.getDate(), 0, 0, 0, 0).getTime();
      const sEndTime = new Date(sEnd.getFullYear(), sEnd.getMonth(), sEnd.getDate(), 23, 59, 59, 999).getTime();
      const currTime = dayStart.getTime();

      if (currTime < sStartTime || currTime > sEndTime) {
        continue;
      }

      let isDayMatch = true;
      if (Array.isArray(slot.availableDays) && slot.availableDays.length > 0) {
        isDayMatch = (slot.availableDays as Weekday[]).includes(requestedWeekday as Weekday);
      }

      if (isDayMatch) {
        const capacity = slot.capacity || 0;
        const bookedCount = slot.bookedCount || 0;
        const availableSeats = Math.max(0, capacity - bookedCount);

        matchingSlots.push({
          timeSlotId: slot._id,
          slotId: slot._id,
          _id: slot._id, // Ensure both slotId and _id are available for frontend consumers
          templeId: slot.templeId,
          serviceId: slot.serviceId,
          date: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: capacity,
          bookedCount: bookedCount,
          availableSeats: availableSeats,
          availableCount: availableSeats,
          isAvailable: availableSeats > 0,
        });
      }
    }

    return ApiResponse.success(
      res,
      matchingSlots,
      'Available time slots retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Public Temple Announcements Discovery
 * GET /api/temples/:templeId/announcements
 * Returns only active, published, and unexpired announcements for the given temple.
 * Explicitly excludes user-sensitive information like createdBy.
 */
export const getPublicTempleAnnouncements = async (
  req: Request<{ templeId: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId } = req.params;

    let targetTempleId: mongoose.Types.ObjectId | string | null = null;
    if (mongoose.Types.ObjectId.isValid(templeId)) {
      targetTempleId = templeId;
    } else {
      const temple = await Temple.findOne({
        slug: templeId.toLowerCase(),
        status: TEMPLE_STATUS.ACTIVE,
      })
        .select('_id')
        .lean();

      if (!temple) {
        throw ApiError.notFound('Temple not found or is currently not active');
      }
      targetTempleId = temple._id as mongoose.Types.ObjectId;
    }

    const now = new Date();

    const announcements = await TempleAnnouncement.find({
      templeId: targetTempleId,
      isActive: true,
      publishedAt: { $lte: now },
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: now } },
      ],
    })
      .select('_id templeId title message type publishedAt expiresAt createdAt updatedAt')
      .sort({ publishedAt: -1 })
      .lean();

    return ApiResponse.success(
      res,
      announcements,
      'Temple announcements retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Public Temple Reviews Discovery
 * GET /api/temples/:templeId/reviews
 * Returns only APPROVED reviews.
 * Safely masks devotee display names (e.g., "Praneeth G.") for privacy.
 * Strictly avoids exposing user emails, phones, or sensitive credentials.
 * Dynamically computes aggregate rating score and count.
 */
export const getPublicTempleReviews = async (
  req: Request<{ templeId: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId } = req.params;

    let targetTempleId: mongoose.Types.ObjectId | string | null = null;
    if (mongoose.Types.ObjectId.isValid(templeId)) {
      targetTempleId = templeId;
    } else {
      const temple = await Temple.findOne({
        slug: templeId.toLowerCase(),
        status: TEMPLE_STATUS.ACTIVE,
      })
        .select('_id')
        .lean();

      if (!temple) {
        throw ApiError.notFound('Temple not found or is currently not active');
      }
      targetTempleId = temple._id as mongoose.Types.ObjectId;
    }

    const reviews = await Review.find({
      templeId: targetTempleId,
      status: REVIEW_STATUS.APPROVED,
    })
      .populate('userId', 'name')
      .select('rating comment createdAt userId')
      .sort({ createdAt: -1 })
      .lean();

    const maskDevoteeName = (fullName?: string | null): string => {
      if (!fullName || typeof fullName !== 'string') return 'Devotee';
      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
    };

    const formattedReviews = reviews.map((r: any) => ({
      _id: r._id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      reviewerName: maskDevoteeName(r.userId?.name),
    }));

    const totalReviews = formattedReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((formattedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
        : null;

    return ApiResponse.success(
      res,
      {
        items: formattedReviews,
        summary: {
          averageRating,
          totalReviews,
        },
      },
      'Temple reviews retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  getPublicTemples,
  getPublicTempleBySlug,
  getPublicTempleServices,
  getPublicServiceAvailability,
  getPublicTempleAnnouncements,
  getPublicTempleReviews,
};
