import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISiteReachMetric {
  date: string;
  uniqueVisitors: string[];
  visitorCount: number;
  pageViews: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISiteReachMetricDocument extends Document<Types.ObjectId, {}, ISiteReachMetric>, ISiteReachMetric {}

export interface ISiteReachMetricModel extends Model<ISiteReachMetric> {}

const siteReachMetricSchema = new Schema<ISiteReachMetric, ISiteReachMetricModel>(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      unique: true,
      index: true,
    },
    uniqueVisitors: {
      type: [String], // Hashed client signatures (IP + UA)
      default: [],
    },
    visitorCount: {
      type: Number,
      default: 0,
    },
    pageViews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const SiteReachMetric: ISiteReachMetricModel =
  (mongoose.models.SiteReachMetric as ISiteReachMetricModel) ||
  mongoose.model<ISiteReachMetric, ISiteReachMetricModel>('SiteReachMetric', siteReachMetricSchema);
export default SiteReachMetric;
