import mongoose from 'mongoose';

export const TEMPLE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
});

export const WEEKDAYS = Object.freeze([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

const dayTimingSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: WEEKDAYS,
      required: true,
    },
    morningOpening: { type: String, default: '06:00' },
    morningClosing: { type: String, default: '12:00' },
    eveningOpening: { type: String, default: '16:00' },
    eveningClosing: { type: String, default: '21:00' },
    isOpen: { type: Boolean, default: true },
    specialNotes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const galleryImageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, trim: true, default: null },
  alt: { type: String, trim: true, default: '' },
  order: { type: Number, default: 0 },
  isThumbnail: { type: Boolean, default: false },
  isBanner: { type: Boolean, default: false },
});

const nearbyPlaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    distance: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const templeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Temple name is required'],
      trim: true,
      maxlength: [200, 'Temple name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Temple slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Temple description is required'],
      trim: true,
    },
    templeType: {
      type: String,
      trim: true,
      default: 'Heritage',
    },

    // Physical Address
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      index: true,
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },

    // Geospatial Coordinates & Map
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    mapUrl: {
      type: String,
      trim: true,
      default: null,
    },

    // Contact Information
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },

    // Structured Timings (Weekday morning/evening intervals & special timings)
    timings: {
      weekly: {
        type: [dayTimingSchema],
        default: () =>
          WEEKDAYS.map((day) => ({
            day,
            morningOpening: '06:00',
            morningClosing: '12:00',
            eveningOpening: '16:00',
            eveningClosing: '21:00',
            isOpen: true,
          })),
      },
      specialNotes: {
        type: String,
        trim: true,
        default: '',
      },
      festivalExceptions: [
        {
          occasion: { type: String, required: true },
          date: { type: Date, required: true },
          openTime: String,
          closeTime: String,
          notes: String,
        },
      ],
    },

    // Guidelines and Facilities
    dressCode: {
      type: String,
      trim: true,
      default: 'Traditional attire recommended.',
    },
    guidelines: {
      type: [String],
      default: [],
    },
    facilities: {
      type: [String],
      default: [],
    },
    parking: {
      type: String,
      trim: true,
      default: '',
    },
    howToReach: {
      byAir: { type: String, default: '' },
      byTrain: { type: String, default: '' },
      byRoad: { type: String, default: '' },
    },

    // Media
    coverImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: null },
      alt: { type: String, default: '' },
    },
    gallery: {
      type: [galleryImageSchema],
      default: [],
    },

    // Discovery & Informational content
    nearbyPlaces: {
      type: [nearbyPlaceSchema],
      default: [],
    },
    faqs: {
      type: [faqSchema],
      default: [],
    },

    // Ownership - Points to the assigned TEMPLE_AUTHORITY user
    authorityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Assigned Categories (Admin / Authority Managed)
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TempleCategory',
      },
    ],

    // Operational Status
    status: {
      type: String,
      enum: {
        values: Object.values(TEMPLE_STATUS),
        message: '{VALUE} is not a valid temple status',
      },
      default: TEMPLE_STATUS.PENDING_APPROVAL,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
templeSchema.index({ categories: 1 });
templeSchema.index({ status: 1, categories: 1 });
templeSchema.index({ city: 1, state: 1 });
templeSchema.index({ status: 1, authorityId: 1 });
templeSchema.index({ status: 1, city: 1, state: 1 });
templeSchema.index({ status: 1, templeType: 1 });
templeSchema.index({ status: 1, slug: 1 });

export const Temple = mongoose.model('Temple', templeSchema);
export default Temple;
