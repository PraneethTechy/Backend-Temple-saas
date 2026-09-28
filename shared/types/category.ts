/**
 * DevaSetu Temple Category & Category Suggestion Types
 */
import type { ID, Timestamps, CloudinaryImage } from './common.js';
import type { SuggestionStatus } from './enums.js';

export interface TempleCategory extends Timestamps {
  _id: ID;
  name: string;
  slug: string;
  description?: string;
  image?: CloudinaryImage;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
  createdBy?: ID;
  updatedBy?: ID;
}

export interface TempleCategorySuggestion extends Timestamps {
  _id: ID;
  templeId: ID;
  suggestedName: string;
  description?: string;
  submittedBy: ID;
  status: SuggestionStatus;
  reviewedBy?: ID;
  reviewedAt?: string;
  rejectionReason?: string;
  createdCategoryId?: ID;
}
