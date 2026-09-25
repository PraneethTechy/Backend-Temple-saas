import mongoose from 'mongoose';

const siteReachMetricSchema = new mongoose.Schema(
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

export const SiteReachMetric = mongoose.model('SiteReachMetric', siteReachMetricSchema);
export default SiteReachMetric;
