import mongoose from 'mongoose';

const savedTempleSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

// Compound unique index prevents duplicate saves per user
savedTempleSchema.index({ userId: 1, templeId: 1 }, { unique: true });
savedTempleSchema.index({ userId: 1, createdAt: -1 });

export const SavedTemple = mongoose.model('SavedTemple', savedTempleSchema);
export default SavedTemple;
