import mongoose from 'mongoose';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm 24-hour format

export const WEEK_DAYS = Object.freeze([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const timeSlotSchema = new mongoose.Schema(
  {
    templeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
      default: function () {
        return this.date || new Date();
      },
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
      default: function () {
        return this.startDate || this.date || new Date();
      },
    },
    // Maintained for backward compatibility
    date: {
      type: Date,
      default: function () {
        return this.startDate || new Date();
      },
      index: true,
    },
    availableDays: {
      type: [String],
      enum: {
        values: WEEK_DAYS,
        message: '{VALUE} is not a valid weekday',
      },
      default: [...WEEK_DAYS],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (HH:mm)'],
      trim: true,
      match: [timeRegex, 'Start time must be in HH:mm 24-hour format (e.g. 06:30)'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (HH:mm)'],
      trim: true,
      match: [timeRegex, 'End time must be in HH:mm 24-hour format (e.g. 07:30)'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be greater than 0'],
    },
    bookedCount: {
      type: Number,
      default: 0,
      min: [0, 'Booked count cannot be negative'],
      validate: {
        validator: function (v) {
          if (this.capacity != null) {
            return v <= this.capacity;
          }
          return true;
        },
        message: 'Booked count ({VALUE}) cannot exceed slot capacity',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property: remainingCapacity
timeSlotSchema.virtual('remainingCapacity').get(function () {
  if (this.capacity == null) return 0;
  return Math.max(0, this.capacity - (this.bookedCount || 0));
});

/**
 * Checks whether this time slot is available for a requested calendar date.
 * Verifies:
 * 1. Slot is active.
 * 2. Requested date falls between startDate and endDate (inclusive, normalized by day).
 * 3. Requested date's day of week matches configured availableDays.
 * 
 * @param {Date|string} requestedDate
 * @returns {boolean}
 */
timeSlotSchema.methods.isAvailableForDate = function (requestedDate) {
  if (!this.isActive) return false;

  const req = new Date(requestedDate);
  if (isNaN(req.getTime())) return false;

  // Normalize all dates to midnight UTC/calendar day for accurate day-range comparison
  const reqTime = new Date(req.getFullYear(), req.getMonth(), req.getDate()).getTime();
  const sDate = new Date(this.startDate);
  const eDate = new Date(this.endDate);
  const startTime = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate()).getTime();
  const endTime = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate()).getTime();

  if (reqTime < startTime || reqTime > endTime) {
    return false;
  }

  // Weekday comparison
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = dayNames[req.getDay()];

  if (Array.isArray(this.availableDays) && this.availableDays.length > 0) {
    return this.availableDays.includes(dayOfWeek);
  }

  return true;
};

// Pre-save validations: startDate <= endDate and startTime < endTime
timeSlotSchema.pre('validate', function (next) {
  if (this.date && !this.startDate) {
    this.startDate = this.date;
  }
  if (this.startDate && !this.endDate) {
    this.endDate = this.startDate;
  }
  if (!this.date && this.startDate) {
    this.date = this.startDate;
  }

  if (this.startDate && this.endDate) {
    const s = new Date(this.startDate);
    const e = new Date(this.endDate);
    const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
    const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
    if (sDay > eDay) {
      this.invalidate('endDate', 'End date must be on or after start date');
    }
  }

  if (this.startTime && this.endTime) {
    if (this.startTime >= this.endTime) {
      this.invalidate('endTime', 'End time must be strictly after start time');
    }
  }

  next();
});

// Indexes for date-range and multi-slot availability queries
timeSlotSchema.index({ templeId: 1, startDate: 1, endDate: 1 });
timeSlotSchema.index({ serviceId: 1, startDate: 1, endDate: 1, isActive: 1 });
timeSlotSchema.index({ serviceId: 1, startDate: 1, startTime: 1 });

export const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);
export default TimeSlot;
