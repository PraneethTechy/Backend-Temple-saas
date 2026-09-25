import mongoose from 'mongoose';

export const SUGGESTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const templeCategorySuggestionSchema = new mongoose.Schema(
  {
    templeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple reference is required for category suggestion'],
      index: true,
    },
    suggestedName: {
      type: String,
      required: [true, 'Suggested category name is required'],
      trim: true,
      maxlength: [100, 'Suggested name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitter user reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: Object.values(SUGGESTION_STATUS),
        message: '{VALUE} is not a valid suggestion status',
      },
      default: SUGGESTION_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    createdCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TempleCategory',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

templeCategorySuggestionSchema.index({ status: 1, createdAt: -1 });

export const TempleCategorySuggestion = mongoose.model(
  'TempleCategorySuggestion',
  templeCategorySuggestionSchema
);
export default TempleCategorySuggestion;
