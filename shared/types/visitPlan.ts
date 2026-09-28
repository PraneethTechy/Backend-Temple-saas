/**
 * DevaSetu AI Pilgrimage & Visit Planning Types
 */
import type { ID, Timestamps } from './common.js';
import type { VisitPlanStatus } from './enums.js';

export interface VisitOriginLocation {
  placeId?: string;
  name?: string;
  formattedAddress?: string;
  latitude: number;
  longitude: number;
}

export interface VisitDestinationLocation {
  templeName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface VisitBookingSnapshot {
  bookingReference: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  endTime?: string;
}

export interface VisitRouteSnapshot {
  distanceMeters?: number;
  distanceKm?: number;
  durationSeconds?: number;
  durationText?: string;
  trafficAware?: boolean;
  travelMode?: string;
  transitMode?: string;
  transitInfo?: any;
  overviewPolyline?: string;
}

export interface VisitPlanningTimings {
  arrivalBufferMinutes?: number;
  safetyBufferMinutes?: number;
  recommendedArrivalAt?: string;
  recommendedDepartureAt?: string;
  recommendedArrivalText?: string;
  recommendedDepartureText?: string;
}

export interface VisitAiGuidance {
  summary?: string;
  tips?: string[];
}

export interface VisitPlan extends Timestamps {
  _id: ID;
  userId: ID;
  bookingId: ID;
  templeId: ID;
  origin: VisitOriginLocation;
  destination: VisitDestinationLocation;
  bookingSnapshot: VisitBookingSnapshot;
  routeSnapshot?: VisitRouteSnapshot;
  planning?: VisitPlanningTimings;
  aiGuidance?: VisitAiGuidance;
  status: VisitPlanStatus;
}
