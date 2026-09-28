import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const SUGGESTION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const);

export type SuggestionStatus = (typeof SUGGESTION_STATUS)[keyof typeof SUGGESTION_STATUS];

export interface ITempleCategorySuggestion {
  templeId: Types.ObjectId;
  suggestedName: string;
  description?: string;
  submittedBy: Types.ObjectId;
  status: SuggestionStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  createdCategoryId?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITempleCategorySuggestionDocument
  extends Document<Types.ObjectId, {}, ITempleCategorySuggestion>,
    ITempleCategorySuggestion {}

export interface ITempleCategorySuggestionModel extends Model<ITempleCategorySuggestion> {}

const templeCategorySuggestionSchema = new Schema<ITempleCategorySuggestion, ITempleCategorySuggestionModel>(
  {
    templeId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: 'TempleCategory',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

templeCategorySuggestionSchema.index({ status: 1, createdAt: -1 });

export const TempleCategorySuggestion: ITempleCategorySuggestionModel =
  (mongoose.models.TempleCategorySuggestion as ITempleCategorySuggestionModel) ||
  mongoose.model<ITempleCategorySuggestion, ITempleCategorySuggestionModel>(
    'TempleCategorySuggestion',
    templeCategorySuggestionSchema
  );
export default TempleCategorySuggestion;
