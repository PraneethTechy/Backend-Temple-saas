/**
 * DevaSetu Temple & Temple Registration Types
 */
import type { ID, Timestamps, GeoLocation, CloudinaryImage } from './common.js';
import type { TempleStatus, RegistrationStatus } from './enums.js';

export interface DayTiming {
  open: string;
  close: string;
  isClosed?: boolean;
}

export interface TempleTimings {
  weekly?: Record<string, DayTiming>;
  specialNotes?: string;
  festivalExceptions?: Array<{
    date: string;
    open: string;
    close: string;
    reason?: string;
  }>;
}

export interface HowToReach {
  byAir?: string;
  byTrain?: string;
  byRoad?: string;
}

export interface TempleFaq {
  question: string;
  answer: string;
}

export interface NearbyPlace {
  name: string;
  distance?: string;
  description?: string;
}

export interface Temple extends Timestamps, GeoLocation {
  _id: ID;
  name: string;
  slug: string;
  description: string;
  templeType: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  email?: string;
  website?: string;
  timings?: TempleTimings;
  dressCode?: string;
  guidelines?: string[];
  facilities?: string[];
  parking?: string;
  howToReach?: HowToReach;
  coverImage?: CloudinaryImage;
  gallery?: CloudinaryImage[];
  nearbyPlaces?: NearbyPlace[];
  faqs?: TempleFaq[];
  authorityId?: ID | null;
  categories?: ID[] | any[];
  status: TempleStatus;
}

export interface TempleRegistration extends Timestamps, GeoLocation {
  _id: ID;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  authorityDesignation: string;
  templeName: string;
  templeType: string;
  description: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  timings?: string;
  facilities?: string[];
  guidelines?: string[];
  documents?: CloudinaryImage[];
  basicTempleImages?: CloudinaryImage[];
  categoryIds?: ID[];
  suggestedCategoryName?: string;
  suggestedCategoryDescription?: string;
  status: RegistrationStatus;
  rejectionReason?: string;
  reviewedBy?: ID;
  reviewedAt?: string;
  createdTempleId?: ID;
}
