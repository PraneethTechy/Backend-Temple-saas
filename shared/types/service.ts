/**
 * DevaSetu Temple Service Types
 */
import type { ID, Timestamps, CloudinaryImage } from './common.js';
import type { ServiceType, Weekday } from './enums.js';

export interface Service extends Timestamps {
  _id: ID;
  templeId: ID;
  name: string;
  type: ServiceType;
  description?: string;
  image?: CloudinaryImage;
  price: number;
  duration: number;
  availableDays?: Weekday[];
  rules?: string[];
  isActive: boolean;
}
