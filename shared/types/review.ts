/**
 * DevaSetu Devotee Review & Rating Types
 */
import type { ID, Timestamps } from './common.js';
import type { ReviewStatus } from './enums.js';

export interface Review extends Timestamps {
  _id: ID;
  userId: ID | any;
  templeId: ID | any;
  bookingId?: ID | any;
  rating: number;
  comment: string;
  status: ReviewStatus;
  isDemo?: boolean;
}

export interface ReviewSummary {
  averageRating: number | null;
  totalReviews: number;
}

export interface CreateReviewInput {
  templeId: ID;
  bookingId?: ID;
  rating: number;
  comment: string;
}

export interface ReviewMetrics {
  total: number;
  pending: number;
  approved: number;
  averageRating: number;
  thisMonth: number;
}

