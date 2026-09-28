import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const REGISTRATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const);

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS];

export interface IRegistrationDocument {
  name: string;
  url: string;
  type?: string;
}

export interface IBasicImage {
  url: string;
  publicId?: string | null;
  alt?: string;
}

export interface ITempleRegistration {
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
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string | null;
  timings?: string;
  facilities: string[];
  guidelines?: string;
  documents: IRegistrationDocument[];
  basicTempleImages: IBasicImage[];
  categoryIds: Types.ObjectId[];
  suggestedCategoryName?: string | null;
  suggestedCategoryDescription?: string | null;
  status: RegistrationStatus;
  rejectionReason?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdTempleId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITempleRegistrationDocument
  extends Document<Types.ObjectId, {}, ITempleRegistration>,
    ITempleRegistration {}

export interface ITempleRegistrationModel extends Model<ITempleRegistration> {}

const documentSchema = new Schema<IRegistrationDocument>(
  {
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'Document URL is required'],
      trim: true,
    },
    type: {
      type: String,
      trim: true,
      default: 'GOVERNMENT_ID',
    },
  },
  { _id: false }
);

const basicImageSchema = new Schema<IBasicImage>(
  {
    url: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
      default: null,
    },
    alt: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const templeRegistrationSchema = new Schema<ITempleRegistration, ITempleRegistrationModel>(
  {
    // Applicant Information
    applicantName: {
      type: String,
      required: [true, 'Applicant name is required'],
      trim: true,
    },
    applicantEmail: {
      type: String,
      required: [true, 'Applicant email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    applicantPhone: {
      type: String,
      required: [true, 'Applicant phone is required'],
      trim: true,
    },
    authorityDesignation: {
      type: String,
      required: [true, 'Authority designation (e.g. Trustee, EO) is required'],
      trim: true,
    },

    // Temple Details
    templeName: {
      type: String,
      required: [true, 'Temple name is required'],
      trim: true,
    },
    templeType: {
      type: String,
      trim: true,
      default: 'Traditional',
    },
    description: {
      type: String,
      required: [true, 'Temple description is required'],
      trim: true,
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
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
    },

    // Geospatial / Map Location
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

    // Basic Information
    timings: {
      type: String,
      trim: true,
      default: '',
    },
    facilities: {
      type: [String],
      default: [],
    },
    guidelines: {
      type: String,
      trim: true,
      default: '',
    },

    // Verification Documents (URLs only, no binaries in DB)
    documents: {
      type: [documentSchema],
      default: [],
    },

    // Initial Media (Cloudinary-ready structure)
    basicTempleImages: {
      type: [basicImageSchema],
      default: [],
    },

    // Selected Existing Categories & Suggestion
    categoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TempleCategory',
      },
    ],
    suggestedCategoryName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Suggested category name cannot exceed 100 characters'],
    },
    suggestedCategoryDescription: {
      type: String,
      trim: true,
      default: null,
      maxlength: [500, 'Suggested category description cannot exceed 500 characters'],
    },

    // Approval Workflow Status
    status: {
      type: String,
      enum: {
        values: Object.values(REGISTRATION_STATUS),
        message: '{VALUE} is not a valid registration status',
      },
      default: REGISTRATION_STATUS.PENDING,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    createdTempleId: {
      type: Schema.Types.ObjectId,
      ref: 'Temple',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
templeRegistrationSchema.index({ status: 1, createdAt: -1 });

export const TempleRegistration: ITempleRegistrationModel =
  (mongoose.models.TempleRegistration as ITempleRegistrationModel) ||
  mongoose.model<ITempleRegistration, ITempleRegistrationModel>('TempleRegistration', templeRegistrationSchema);
export default TempleRegistration;
