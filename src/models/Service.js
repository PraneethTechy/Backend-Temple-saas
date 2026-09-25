import mongoose from 'mongoose';
import { WEEKDAYS } from './Temple.js';

export const SERVICE_TYPES = Object.freeze({
  DARSHAN: 'DARSHAN',
  SEVA: 'SEVA',
  POOJA: 'POOJA',
  SPECIAL_ENTRY: 'SPECIAL_ENTRY',
  PRASADAM: 'PRASADAM',
  DONATION: 'DONATION',
});

const serviceSchema = new mongoose.Schema(
  {
    templeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      minlength: [2, 'Service name must be at least 2 characters'],
      maxlength: [150, 'Service name cannot exceed 150 characters'],
    },
    type: {
      type: String,
      required: [true, 'Service type is required'],
      enum: {
        values: Object.values(SERVICE_TYPES),
        message: '{VALUE} is not a valid service type',
      },
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: null },
      alt: { type: String, default: '' },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    duration: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
      default: 0, // in minutes (0 indicates instant or untimed)
    },
    availableDays: {
      type: [String],
      enum: {
        values: WEEKDAYS,
        message: '{VALUE} is not a valid weekday',
      },
      default: () => [...WEEKDAYS],
    },
    rules: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
serviceSchema.index({ templeId: 1, isActive: 1 });
serviceSchema.index({ templeId: 1, type: 1, isActive: 1 });

export const Service = mongoose.model('Service', serviceSchema);
export default Service;
