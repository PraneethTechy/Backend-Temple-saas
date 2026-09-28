import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const TEMPLE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
} as const);

export type TempleStatus = (typeof TEMPLE_STATUS)[keyof typeof TEMPLE_STATUS];

export const WEEKDAYS = Object.freeze([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const);

export type Weekday = (typeof WEEKDAYS)[number];

export interface IDayTiming {
  day: Weekday;
  morningOpening?: string;
  morningClosing?: string;
  eveningOpening?: string;
  eveningClosing?: string;
  isOpen?: boolean;
  specialNotes?: string;
}

export interface IGalleryImage {
  _id?: Types.ObjectId;
  url: string;
  publicId?: string | null;
  alt?: string;
  order?: number;
  isThumbnail?: boolean;
  isBanner?: boolean;
}

export interface INearbyPlace {
  name: string;
  distance?: string;
  description?: string;
}

export interface IFaq {
  question: string;
  answer: string;
}

export interface IFestivalException {
  occasion: string;
  date: Date;
  openTime?: string;
  closeTime?: string;
  notes?: string;
}

export interface ITempleTimings {
  weekly: IDayTiming[];
  specialNotes?: string;
  festivalExceptions?: IFestivalException[];
}

export interface IHowToReach {
  byAir?: string;
  byTrain?: string;
  byRoad?: string;
}

export interface ICoverImage {
  url?: string;
  publicId?: string | null;
  alt?: string;
}

export interface ITemple {
  name: string;
  slug: string;
  description: string;
  templeType?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string | null;
  phone?: string;
  email?: string;
  website?: string;
  timings: ITempleTimings;
  dressCode?: string;
  guidelines: string[];
  facilities: string[];
  parking?: string;
  howToReach?: IHowToReach;
  coverImage?: ICoverImage;
  gallery: IGalleryImage[];
  nearbyPlaces: INearbyPlace[];
  faqs: IFaq[];
  authorityId?: Types.ObjectId | null;
  categories: Types.ObjectId[];
  status: TempleStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITempleDocument extends Document<Types.ObjectId, {}, ITemple>, ITemple {}

export interface ITempleModel extends Model<ITemple> {}

const dayTimingSchema = new Schema<IDayTiming>(
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

const galleryImageSchema = new Schema<IGalleryImage>({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, trim: true, default: null },
  alt: { type: String, trim: true, default: '' },
  order: { type: Number, default: 0 },
  isThumbnail: { type: Boolean, default: false },
  isBanner: { type: Boolean, default: false },
});

const nearbyPlaceSchema = new Schema<INearbyPlace>(
  {
    name: { type: String, required: true, trim: true },
    distance: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const faqSchema = new Schema<IFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const templeSchema = new Schema<ITemple, ITempleModel>(
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
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Assigned Categories (Admin / Authority Managed)
    categories: [
      {
        type: Schema.Types.ObjectId,
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

export const Temple: ITempleModel =
  (mongoose.models.Temple as ITempleModel) || mongoose.model<ITemple, ITempleModel>('Temple', templeSchema);
export default Temple;
