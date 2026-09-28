/**
 * DevaSetu Booking Engine & Devotee Booking Types
 */
import type { ID, Timestamps } from './common.js';
import type { BookingStatus, PaymentStatus } from './enums.js';

export type DevoteeGender = 'MALE' | 'FEMALE' | 'OTHER';
export type DevoteeIdType = 'AADHAAR' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'OTHER';

export interface DevoteeDetail {
  name: string;
  age: number | string;
  gender: DevoteeGender;
  idType: DevoteeIdType;
  idNumber?: string;
}

export interface BookingQRCode {
  code?: string;
  generatedAt?: string;
}

export interface Booking extends Timestamps {
  _id: ID;
  bookingReference: string;
  userId: ID | any;
  templeId: ID | any;
  serviceId: ID | any;
  timeSlotId: ID | any;
  bookingDate: string;
  devotees: DevoteeDetail[];
  quantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  qrVerificationToken?: string;
  qrCode?: BookingQRCode;
  checkedInAt?: string | null;
  checkedInBy?: ID | null;
  completedAt?: string | null;
}

export interface CreateBookingInput {
  templeId: ID;
  serviceId: ID;
  timeSlotId: ID;
  bookingDate: string;
  devotees: DevoteeDetail[];
}

export interface CancelBookingInput {
  reason?: string;
}
