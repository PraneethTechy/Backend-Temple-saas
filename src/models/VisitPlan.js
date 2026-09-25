import mongoose from 'mongoose';

export const VISIT_PLAN_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  OUTDATED: 'OUTDATED',
});

const visitPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    templeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
      index: true,
    },

    origin: {
      placeId: { type: String, trim: true, default: '' },
      name: { type: String, trim: true, default: '' },
      formattedAddress: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    destination: {
      templeName: { type: String, required: true, trim: true },
      formattedAddress: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },

    bookingSnapshot: {
      bookingReference: { type: String, required: true, trim: true },
      serviceName: { type: String, required: true, trim: true },
      bookingDate: { type: Date, required: true },
      startTime: { type: String, required: true, trim: true },
      endTime: { type: String, required: true, trim: true },
    },

    routeSnapshot: {
      distanceMeters: { type: Number, default: 0 },
      distanceKm: { type: Number, default: 0 },
      durationSeconds: { type: Number, default: 0 },
      durationText: { type: String, default: '' },
      trafficAware: { type: Boolean, default: true },
      travelMode: { type: String, default: 'CAR' },
      transitMode: { type: String, default: null },
      transitInfo: { type: Array, default: [] },
      overviewPolyline: { type: String, default: '' },
    },

    planning: {
      arrivalBufferMinutes: { type: Number, default: 30 },
      safetyBufferMinutes: { type: Number, default: 30 },
      recommendedArrivalAt: { type: Date, required: true },
      recommendedDepartureAt: { type: Date, required: true },
      recommendedArrivalText: { type: String, default: '' },
      recommendedDepartureText: { type: String, default: '' },
    },

    aiGuidance: {
      summary: { type: String, default: '' },
      tips: { type: [String], default: [] },
    },

    status: {
      type: String,
      enum: Object.values(VISIT_PLAN_STATUS),
      default: VISIT_PLAN_STATUS.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce one active/latest plan per (userId, bookingId)
visitPlanSchema.index({ userId: 1, bookingId: 1 }, { unique: true });
visitPlanSchema.index({ userId: 1, status: 1 });

export const VisitPlan = mongoose.model('VisitPlan', visitPlanSchema);
export default VisitPlan;
