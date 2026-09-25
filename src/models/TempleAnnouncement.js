import mongoose from 'mongoose';

export const ANNOUNCEMENT_TYPES = Object.freeze({
  GENERAL: 'GENERAL',
  IMPORTANT: 'IMPORTANT',
  FESTIVAL: 'FESTIVAL',
  DARSHAN: 'DARSHAN',
  SERVICE: 'SERVICE',
  NOTICE: 'NOTICE',
});

const templeAnnouncementSchema = new mongoose.Schema(
  {
    templeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Temple',
      required: [true, 'Temple ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Announcement message is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: {
        values: Object.values(ANNOUNCEMENT_TYPES),
        message: '{VALUE} is not a valid announcement type',
      },
      default: ANNOUNCEMENT_TYPES.GENERAL,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Performance indexes
templeAnnouncementSchema.index({ templeId: 1 });
templeAnnouncementSchema.index({ templeId: 1, isActive: 1 });
templeAnnouncementSchema.index({ templeId: 1, publishedAt: -1 });

export const TempleAnnouncement = mongoose.model(
  'TempleAnnouncement',
  templeAnnouncementSchema
);

export default TempleAnnouncement;
