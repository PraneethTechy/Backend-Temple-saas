import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const BOOKING_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const);

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const);

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export interface IDevotee {
  name: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  idType?: 'AADHAAR' | 'PASSPORT' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'OTHER';
  idNumber?: string;
}

export interface IQrCode {
  code?: string | null;
  generatedAt?: Date | null;
}

export interface IBooking {
  bookingReference: string;
  userId: Types.ObjectId;
  templeId: Types.ObjectId;
  serviceId: Types.ObjectId;
  timeSlotId: Types.ObjectId;
  bookingDate: Date;
  devotees: IDevotee[];
  quantity: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  qrVerificationToken?: string | null;
  qrCode?: IQrCode;
  checkedInAt?: Date | null;
  checkedInBy?: Types.ObjectId | null;
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBookingMethods {
  toMaskedJSON(): Record<string, any>;
}

export interface IBookingDocument extends Document<Types.ObjectId, {}, IBooking>, IBooking, IBookingMethods {}

export interface IBookingModel extends Model<IBooking, {}, IBookingMethods> {}

const devoteeSchema = new Schema<IDevotee>(
  {
    name: {
      type: String,
      required: [true, 'Devotee name is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Devotee age is required'],
      min: [0, 'Age cannot be negative'],
      max: [120, 'Age cannot exceed 120'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['MALE', 'FEMALE', 'OTHER'],
    },
    idType: {
      type: String,
      enum: ['AADHAAR', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE', 'OTHER'],
      default: 'OTHER',
    },
    idNumber: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const bookingSchema = new Schema<IBooking, IBookingModel, IBookingMethods>(
  {
    bookingReference: {
      type: String,
      required: [true, 'Booking reference is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    templeId: {
      type: Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },
    timeSlotId: {
      type: Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: [true, 'TimeSlot ID is required'],
      index: true,
    },
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required'],
      index: true,
    },
    devotees: {
      type: [devoteeSchema],
      validate: {
        validator: function (v: IDevotee[]) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one devotee must be specified',
      },
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: {
        values: Object.values(PAYMENT_STATUS),
        message: '{VALUE} is not a valid payment status',
      },
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    bookingStatus: {
      type: String,
      required: true,
      enum: {
        values: Object.values(BOOKING_STATUS),
        message: '{VALUE} is not a valid booking status',
      },
      default: BOOKING_STATUS.PENDING,
      index: true,
    },

    // Cryptographically random verification token (unpredictable token for gate scanning/verification)
    qrVerificationToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      default: null,
    },

    // QR Verification payload (stores non-sensitive verification token/hash only)
    qrCode: {
      code: {
        type: String,
        trim: true,
        default: null,
      },
      generatedAt: {
        type: Date,
        default: null,
      },
    },

    // Check-in and Completion Audit
    checkedInAt: {
      type: Date,
      default: null,
    },
    checkedInBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helper method to produce a safe devotee view with masked ID numbers
bookingSchema.methods.toMaskedJSON = function (this: any) {
  const doc = this.toObject ? this.toObject() : { ...this };
  if (Array.isArray(doc.devotees)) {
    doc.devotees = doc.devotees.map((d: IDevotee) => {
      const copy = { ...d };
      if (copy.idNumber && copy.idNumber.length > 4) {
        const visible = copy.idNumber.slice(-4);
        copy.idNumber = `XXXX-XXXX-${visible}`;
      } else if (copy.idNumber) {
        copy.idNumber = 'XXXX';
      }
      return copy;
    });
  }
  return doc;
};

// Indexes
bookingSchema.index({ userId: 1, bookingStatus: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ templeId: 1, bookingDate: 1, bookingStatus: 1 });
bookingSchema.index({ templeId: 1, bookingStatus: 1 });
bookingSchema.index({ serviceId: 1, bookingDate: 1 });
bookingSchema.index({ timeSlotId: 1, bookingDate: 1 });

export const Booking: IBookingModel =
  (mongoose.models.Booking as IBookingModel) || mongoose.model<IBooking, IBookingModel>('Booking', bookingSchema);
export default Booking;
