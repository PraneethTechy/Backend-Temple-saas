/**
 * DevaSetu Time Slot & Availability Discovery Types
 */
import type { ID, Timestamps } from './common.js';
import type { Weekday } from './enums.js';

export interface TimeSlot extends Timestamps {
  _id: ID;
  templeId: ID;
  serviceId: ID;
  startDate: string;
  endDate: string;
  date?: string;
  availableDays?: Weekday[];
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remainingCapacity?: number;
  isActive: boolean;
}

export interface TimeSlotAvailability {
  timeSlotId: ID;
  slotId?: ID;
  _id?: ID;
  serviceId: ID;
  templeId?: ID;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  availableSeats: number;
  availableCount: number;
  isAvailable: boolean;
}

export interface MonthDayAvailability {
  date: string;
  isAvailable: boolean;
  availableSlotsCount: number;
  totalSlotsCount: number;
}

export interface MonthlyServiceAvailability {
  month: string;
  days: MonthDayAvailability[];
}
