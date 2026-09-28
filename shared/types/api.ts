/**
 * DevaSetu API Request & Response Contracts
 * Matches ApiResponse.js and ApiError.js conventions
 */
import type { PaginationMeta } from './common.js';

export interface ApiResponse<T = any> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: Array<{
    field?: string;
    message: string;
    [key: string]: any;
  }>;
  stack?: string;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export type PaginatedApiResponse<T> = ApiResponse<PaginatedData<T>>;
