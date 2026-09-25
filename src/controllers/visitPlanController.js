import mongoose from 'mongoose';
import { Booking, BOOKING_STATUS, PAYMENT_STATUS } from '../models/Booking.js';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { VisitPlan, VISIT_PLAN_STATUS } from '../models/VisitPlan.js';
import { calculateRoute, searchPlaces, getPlaceDetails } from '../services/googleMapsService.js';
import { calculateVisitSchedule } from '../services/visitPlanningService.js';
import { generateVisitGuidance } from '../services/openRouterService.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

/**
 * Get Devotee's Upcoming Confirmed Bookings with Associated Visit Plans
 * GET /api/visit-plans
 * Authenticated DEVOTEE only
 */
export const getUpcomingBookingsWithPlans = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Fetch confirmed & paid upcoming bookings
    const bookings = await Booking.find({
      userId,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingDate: { $gte: startOfToday },
    })
      .populate('templeId', 'name slug city state address latitude longitude coverImage dressCode parking facilities howToReach')
      .populate('serviceId', 'name type price duration')
      .populate('timeSlotId', 'startTime endTime')
      .sort({ bookingDate: 1, 'timeSlotId.startTime': 1 });

    const bookingIds = bookings.map((b) => b._id);

    // Fetch any saved visit plans for these bookings
    const existingPlans = await VisitPlan.find({
      userId,
      bookingId: { $in: bookingIds },
      status: VISIT_PLAN_STATUS.ACTIVE,
    });

    const planMap = new Map();
    existingPlans.forEach((plan) => {
      planMap.set(plan.bookingId.toString(), plan);
    });

    const items = bookings.map((booking) => {
      const bObj = booking.toObject();
      const plan = planMap.get(booking._id.toString()) || null;
      return {
        ...bObj,
        savedPlan: plan,
      };
    });

    return ApiResponse.success(
      res,
      {
        count: items.length,
        bookings: items,
      },
      'Upcoming confirmed bookings retrieved successfully.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Saved Visit Plan by Booking ID
 * GET /api/visit-plans/:bookingId
 * Authenticated DEVOTEE only
 */
export const getVisitPlanByBookingId = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('Invalid booking ID.');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    if (!booking.userId.equals(userId)) {
      throw ApiError.forbidden('You are not authorized to access this visit plan.');
    }

    const visitPlan = await VisitPlan.findOne({
      userId,
      bookingId,
      status: VISIT_PLAN_STATUS.ACTIVE,
    });

    return ApiResponse.success(
      res,
      { visitPlan: visitPlan || null },
      visitPlan ? 'Visit plan retrieved.' : 'No saved visit plan found.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Generate or Recalculate Visit Plan
 * POST /api/visit-plans/:bookingId/generate
 * Authenticated DEVOTEE only
 */
export const generateVisitPlan = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { bookingId } = req.params;
    const { origin } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw ApiError.badRequest('Invalid booking ID.');
    }

    // 1. Validate Origin input
    if (!origin || typeof origin !== 'object') {
      throw ApiError.badRequest('Origin information is required.');
    }

    const originLat = Number(origin.latitude);
    const originLng = Number(origin.longitude);
    const originAddress = origin.formattedAddress?.trim() || origin.name?.trim() || '';

    if (isNaN(originLat) || isNaN(originLng) || !originAddress) {
      throw ApiError.badRequest(
        'Valid starting location with address, latitude, and longitude is required.'
      );
    }

    // 2. Fetch & Validate Booking Ownership and Eligibility
    const booking = await Booking.findById(bookingId)
      .populate('templeId')
      .populate('serviceId')
      .populate('timeSlotId');

    if (!booking) {
      throw ApiError.notFound('Booking not found.');
    }

    if (!booking.userId.equals(userId)) {
      throw ApiError.forbidden('You are not authorized to plan for this booking.');
    }

    if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED) {
      throw ApiError.badRequest('Only confirmed bookings are eligible for visit planning.');
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    if (new Date(booking.bookingDate).getTime() < startOfToday.getTime()) {
      throw ApiError.badRequest('Cannot plan a visit for an expired past booking.');
    }

    const temple = booking.templeId;
    if (!temple) {
      throw ApiError.notFound('Associated temple not found.');
    }

    // 3. Ensure Temple Destination Coordinates
    let destLat = temple.latitude;
    let destLng = temple.longitude;

    if (destLat == null || destLng == null || isNaN(Number(destLat)) || isNaN(Number(destLng))) {
      throw ApiError.badRequest('Temple location coordinates are currently unavailable.');
    }

    const destination = {
      templeName: temple.name,
      formattedAddress: temple.address ? `${temple.address}, ${temple.city}, ${temple.state}` : `${temple.name}, ${temple.city}`,
      latitude: Number(destLat),
      longitude: Number(destLng),
    };

    const originPayload = {
      placeId: origin.placeId || '',
      name: origin.name || originAddress,
      formattedAddress: originAddress,
      latitude: originLat,
      longitude: originLng,
    };

    const travelMode = (req.body.travelMode || 'CAR').toUpperCase();
    const transitMode = req.body.transitMode ? req.body.transitMode.toUpperCase() : null;

    // 4. Calculate Google Route
    logger.info(`[VisitPlan] Calculating ${travelMode} route from ${originAddress} to ${temple.name}...`);
    const routeResult = await calculateRoute({
      origin: originPayload,
      destination,
      travelMode,
      transitMode,
    });

    // 5. Calculate Deterministic Visit Schedule
    const slotStartTime = booking.timeSlotId?.startTime || '07:00';
    const schedule = calculateVisitSchedule({
      bookingDate: booking.bookingDate,
      slotStartTime,
      distanceMeters: routeResult.distanceMeters,
      durationSeconds: routeResult.durationSeconds,
    });

    // 6. Generate Grounded AI Guidance
    logger.info('[VisitPlan] Generating AI visit guidance...');
    const aiGuidance = await generateVisitGuidance({
      temple,
      booking: {
        bookingReference: booking.bookingReference,
        serviceName: booking.serviceId?.name || 'Darshan',
        bookingDate: booking.bookingDate,
        startTime: slotStartTime,
        endTime: booking.timeSlotId?.endTime || '07:30',
      },
      route: {
        originAddress,
        distanceKm: routeResult.distanceKm,
        durationText: routeResult.durationText,
        trafficAware: routeResult.trafficAware,
      },
      planning: {
        recommendedArrivalText: schedule.recommendedArrivalText,
        recommendedDepartureText: schedule.recommendedDepartureText,
        departureTimeOnly: schedule.departureTimeOnly,
        explanationCallout: schedule.explanationCallout,
      },
    });

    // 7. Upsert VisitPlan into MongoDB
    const planDoc = {
      userId,
      bookingId: booking._id,
      templeId: temple._id,
      origin: originPayload,
      destination,
      bookingSnapshot: {
        bookingReference: booking.bookingReference,
        serviceName: booking.serviceId?.name || 'Darshan',
        bookingDate: booking.bookingDate,
        startTime: slotStartTime,
        endTime: booking.timeSlotId?.endTime || '07:30',
      },
      routeSnapshot: {
        distanceMeters: routeResult.distanceMeters,
        distanceKm: routeResult.distanceKm,
        durationSeconds: routeResult.durationSeconds,
        durationText: routeResult.durationText,
        trafficAware: routeResult.trafficAware,
        travelMode: routeResult.travelMode || travelMode,
        transitMode: routeResult.transitMode || transitMode,
        transitInfo: routeResult.transitInfo || [],
        overviewPolyline: routeResult.overviewPolyline || '',
      },
      planning: {
        arrivalBufferMinutes: schedule.arrivalBufferMinutes,
        safetyBufferMinutes: schedule.safetyBufferMinutes,
        recommendedArrivalAt: schedule.recommendedArrivalAt,
        recommendedDepartureAt: schedule.recommendedDepartureAt,
        recommendedArrivalText: schedule.recommendedArrivalText,
        recommendedDepartureText: schedule.recommendedDepartureText,
      },
      aiGuidance,
      status: VISIT_PLAN_STATUS.ACTIVE,
    };

    const savedPlan = await VisitPlan.findOneAndUpdate(
      { userId, bookingId: booking._id },
      { $set: planDoc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`[VisitPlan] Visit plan saved for booking ${booking.bookingReference}`);

    return ApiResponse.success(
      res,
      {
        visitPlan: savedPlan,
        explanationCallout: schedule.explanationCallout,
      },
      'Visit plan generated and saved successfully.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Autocomplete starting location using Google Places API (New)
 * GET /api/visit-plans/places/autocomplete?input=...
 */
export const autocompletePlaces = async (req, res, next) => {
  try {
    const { input } = req.query;
    if (!input || !input.trim()) {
      return ApiResponse.success(res, { suggestions: [] });
    }

    const suggestions = await searchPlaces(input.trim());
    return ApiResponse.success(res, { suggestions });
  } catch (error) {
    next(error);
  }
};

/**
 * Get place location details using Google Places API (New)
 * GET /api/visit-plans/places/details/:placeId
 */
export const getPlaceDetailsById = async (req, res, next) => {
  try {
    const { placeId } = req.params;
    if (!placeId) {
      throw ApiError.badRequest('Place ID is required.');
    }

    const place = await getPlaceDetails(placeId);
    if (!place) {
      throw ApiError.notFound('Place details could not be retrieved.');
    }

    return ApiResponse.success(res, { place });
  } catch (error) {
    next(error);
  }
};

export default {
  getUpcomingBookingsWithPlans,
  getVisitPlanByBookingId,
  generateVisitPlan,
  autocompletePlaces,
  getPlaceDetailsById,
};
