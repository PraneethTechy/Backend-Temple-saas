import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ISavedTemple {
  userId: Types.ObjectId;
  templeId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISavedTempleDocument extends Document<Types.ObjectId, {}, ISavedTemple>, ISavedTemple {}

export interface ISavedTempleModel extends Model<ISavedTemple> {}

const savedTempleSchema = new Schema<ISavedTemple, ISavedTempleModel>(
  {
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
  },
  {
    timestamps: true,
  }
);

// Compound unique index prevents duplicate saves per user
savedTempleSchema.index({ userId: 1, templeId: 1 }, { unique: true });
savedTempleSchema.index({ userId: 1, createdAt: -1 });

export const SavedTemple: ISavedTempleModel =
  (mongoose.models.SavedTemple as ISavedTempleModel) ||
  mongoose.model<ISavedTemple, ISavedTempleModel>('SavedTemple', savedTempleSchema);
export default SavedTemple;
