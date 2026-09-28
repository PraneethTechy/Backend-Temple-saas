import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ITempleCategory {
  name: string;
  slug: string;
  description?: string;
  image?: string | null;
  icon?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITempleCategoryDocument extends Document<Types.ObjectId, {}, ITempleCategory>, ITempleCategory {}

export interface ITempleCategoryModel extends Model<ITempleCategory> {}

const templeCategorySchema = new Schema<ITempleCategory, ITempleCategoryModel>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
    icon: {
      type: String,
      trim: true,
      default: null,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound indexes
templeCategorySchema.index({ isActive: 1, displayOrder: 1, name: 1 });

export const TempleCategory: ITempleCategoryModel =
  (mongoose.models.TempleCategory as ITempleCategoryModel) ||
  mongoose.model<ITempleCategory, ITempleCategoryModel>('TempleCategory', templeCategorySchema);
export default TempleCategory;
