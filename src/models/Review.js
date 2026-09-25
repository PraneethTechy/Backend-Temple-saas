import mongoose from 'mongoose';

export const REVIEW_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const reviewSchema = new mongoose.Schema(
  {
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
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [3, 'Comment must be at least 3 characters'],
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(REVIEW_STATUS),
        message: '{VALUE} is not a valid review status',
      },
      default: REVIEW_STATUS.PENDING,
      index: true,
    },
    photos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: null },
        alt: { type: String, default: 'Devotee review photo' },
      },
    ],
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient public query of approved temple reviews
reviewSchema.index({ templeId: 1, status: 1 });
reviewSchema.index({ userId: 1, templeId: 1 });
reviewSchema.index({ userId: 1, bookingId: 1 }, { unique: true, sparse: true });

export const Review = mongoose.model('Review', reviewSchema);
export default Review;
