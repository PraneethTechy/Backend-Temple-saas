/**
 * DevaSetu Temple Announcement & Admin Recommendation Types
 */
import type { ID, Timestamps } from './common.js';
import type { AnnouncementType, RecommendationStatus } from './enums.js';

export interface TempleAnnouncement extends Timestamps {
  _id: ID;
  templeId: ID;
  title: string;
  message: string;
  type: AnnouncementType;
  isActive: boolean;
  publishedAt: string;
  expiresAt?: string | null;
  createdBy?: ID;
}

export interface TempleRecommendation extends Timestamps {
  _id: ID;
  templeId: ID;
  title: string;
  category: string;
  observedFeedback?: string;
  suggestedAction?: string;
  status: RecommendationStatus;
  createdAdminId: ID;
  statusUpdatedAt?: string;
  statusUpdatedBy?: ID;
}
