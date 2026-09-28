import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const RECOMMENDATION_STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
} as const);

export type RecommendationStatus = (typeof RECOMMENDATION_STATUS)[keyof typeof RECOMMENDATION_STATUS];

export interface ITempleRecommendation {
  templeId: Types.ObjectId;
  title: string;
  category: string;
  observedFeedback: string;
  suggestedAction: string;
  status: RecommendationStatus;
  createdAdminId: Types.ObjectId;
  statusUpdatedAt?: Date | null;
  statusUpdatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITempleRecommendationDocument
  extends Document<Types.ObjectId, {}, ITempleRecommendation>,
    ITempleRecommendation {}

export interface ITempleRecommendationModel extends Model<ITempleRecommendation> {}

const templeRecommendationSchema = new Schema<ITempleRecommendation, ITempleRecommendationModel>(
  {
    templeId: {
      type: Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Recommendation title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'General Operations',
    },
    observedFeedback: {
      type: String,
      required: [true, 'Observed feedback is required'],
      trim: true,
      maxlength: [1000, 'Observed feedback cannot exceed 1000 characters'],
    },
    suggestedAction: {
      type: String,
      required: [true, 'Suggested action is required'],
      trim: true,
      maxlength: [2000, 'Suggested action cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(RECOMMENDATION_STATUS),
        message: '{VALUE} is not a valid recommendation status',
      },
      default: RECOMMENDATION_STATUS.OPEN,
      index: true,
    },
    createdAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required'],
      index: true,
    },
    statusUpdatedAt: {
      type: Date,
      default: null,
    },
    statusUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

templeRecommendationSchema.index({ templeId: 1, status: 1 });
templeRecommendationSchema.index({ createdAt: -1 });

export const TempleRecommendation: ITempleRecommendationModel =
  (mongoose.models.TempleRecommendation as ITempleRecommendationModel) ||
  mongoose.model<ITempleRecommendation, ITempleRecommendationModel>(
    'TempleRecommendation',
    templeRecommendationSchema
  );
export default TempleRecommendation;
