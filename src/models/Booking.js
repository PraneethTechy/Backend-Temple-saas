import mongoose from 'mongoose';

export const BOOKING_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

const devoteeSchema = new mongoose.Schema(
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

const bookingSchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
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
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
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
        validator: function (v) {
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
      type: mongoose.Schema.Types.ObjectId,
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
bookingSchema.methods.toMaskedJSON = function () {
  const doc = this.toObject ? this.toObject() : { ...this };
  if (Array.isArray(doc.devotees)) {
    doc.devotees = doc.devotees.map((d) => {
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

export const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
