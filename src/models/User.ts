import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES, ALL_ROLES, type UserRole } from './userRole.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/;

export interface IUser {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: UserRole;
  templeId?: Types.ObjectId | null;
  isActive: boolean;
  isEmailVerified: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserDocument extends Document<Types.ObjectId, {}, IUser>, IUser, IUserMethods {}

export interface IUserModel extends Model<IUser, {}, IUserMethods> {}

const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailRegex, 'Please provide a valid email address'],
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          return !v || phoneRegex.test(v);
        },
        message: 'Please provide a valid phone number',
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ALL_ROLES as readonly string[],
        message: '{VALUE} is not a valid user role',
      },
      default: USER_ROLES.DEVOTEE,
      index: true,
    },
    templeId: {
      type: Schema.Types.ObjectId,
      ref: 'Temple',
      default: null,
      validate: {
        validator: function (this: any, v: Types.ObjectId | null) {
          // templeId is mandatory if and only if the user is a TEMPLE_AUTHORITY
          if (this.role === USER_ROLES.TEMPLE_AUTHORITY) {
            return v != null;
          }
          return true;
        },
        message: 'templeId is required when user role is TEMPLE_AUTHORITY',
      },
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to hash password securely with bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// Instance method to verify password
userSchema.methods.comparePassword = async function (this: IUserDocument, candidatePassword: string): Promise<boolean> {
  if (!this.password) {
    throw new Error('Password hash not selected for comparison');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: IUserModel =
  (mongoose.models.User as IUserModel) || mongoose.model<IUser, IUserModel>('User', userSchema);
export default User;
