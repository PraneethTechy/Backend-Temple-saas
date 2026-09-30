import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IConversation {
  templeId: Types.ObjectId;
  authorityId?: Types.ObjectId | null;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadForAdmin: number;
  unreadForAuthority: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConversationDocument
  extends Document<Types.ObjectId, {}, IConversation>,
    IConversation {}

export interface IConversationModel extends Model<IConversation> {}

const conversationSchema = new Schema<IConversation, IConversationModel>(
  {
    templeId: {
      type: Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple reference is required for conversation'],
      unique: true,
      index: true,
    },
    authorityId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessage: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Last message cannot exceed 2000 characters'],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unreadForAdmin: {
      type: Number,
      default: 0,
      min: [0, 'Unread count cannot be negative'],
    },
    unreadForAuthority: {
      type: Number,
      default: 0,
      min: [0, 'Unread count cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup and ordering
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation: IConversationModel =
  (mongoose.models.Conversation as IConversationModel) ||
  mongoose.model<IConversation, IConversationModel>('Conversation', conversationSchema);

export default Conversation;
