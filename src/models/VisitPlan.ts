import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const VISIT_PLAN_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  OUTDATED: 'OUTDATED',
} as const);

export type VisitPlanStatus = (typeof VISIT_PLAN_STATUS)[keyof typeof VISIT_PLAN_STATUS];

export interface IPlanOrigin {
  placeId?: string;
  name?: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface IPlanDestination {
  templeName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface IBookingSnapshot {
  bookingReference: string;
  serviceName: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
}

export interface IRouteSnapshot {
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
  durationText?: string;
  trafficAware?: boolean;
  travelMode?: string;
  transitMode?: string | null;
  transitInfo?: any[];
  overviewPolyline?: string;
}

export interface IPlanning {
  arrivalBufferMinutes?: number;
  safetyBufferMinutes?: number;
  recommendedArrivalAt: Date;
  recommendedDepartureAt: Date;
  recommendedArrivalText?: string;
  recommendedDepartureText?: string;
}

export interface IAiGuidance {
  summary?: string;
  tips?: string[];
}

export interface IVisitPlan {
  userId: Types.ObjectId;
  bookingId: Types.ObjectId;
  templeId: Types.ObjectId;
  origin: IPlanOrigin;
  destination: IPlanDestination;
  bookingSnapshot: IBookingSnapshot;
  routeSnapshot: IRouteSnapshot;
  planning: IPlanning;
  aiGuidance: IAiGuidance;
  status: VisitPlanStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVisitPlanDocument extends Document<Types.ObjectId, {}, IVisitPlan>, IVisitPlan {}

export interface IVisitPlanModel extends Model<IVisitPlan> {}

const visitPlanSchema = new Schema<IVisitPlan, IVisitPlanModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    templeId: {
      type: Schema.Types.ObjectId,
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

export const VisitPlan: IVisitPlanModel =
  (mongoose.models.VisitPlan as IVisitPlanModel) ||
  mongoose.model<IVisitPlan, IVisitPlanModel>('VisitPlan', visitPlanSchema);
export default VisitPlan;
