/**
 * DevaSetu Common Utility & Primitive Types
 */

export type ID = string;

export interface Timestamps {
  createdAt: string;
  updatedAt?: string;
}

export interface GeoLocation {
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
}

export interface CloudinaryImage {
  url: string;
  publicId?: string;
  alt?: string;
}

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
}
