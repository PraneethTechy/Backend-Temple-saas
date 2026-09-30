import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IMessage {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderRole: 'ADMIN' | 'TEMPLE_AUTHORITY';
  message: string;
  readAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IMessageDocument
  extends Document<Types.ObjectId, {}, IMessage>,
    IMessage {}

export interface IMessageModel extends Model<IMessage> {}

const messageSchema = new Schema<IMessage, IMessageModel>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation reference is required'],
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
    },
    senderRole: {
      type: String,
      required: [true, 'Sender role is required'],
      enum: {
        values: ['ADMIN', 'TEMPLE_AUTHORITY'],
        message: '{VALUE} is not authorized to send messages in this channel',
      },
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: [4000, 'Message cannot exceed 4000 characters'],
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for chronological querying of conversation history
messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message: IMessageModel =
  (mongoose.models.Message as IMessageModel) ||
  mongoose.model<IMessage, IMessageModel>('Message', messageSchema);

export default Message;
