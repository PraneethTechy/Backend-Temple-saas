import mongoose from 'mongoose';
import { TempleAnnouncement, ANNOUNCEMENT_TYPES } from '../models/TempleAnnouncement.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Get all announcements for the authenticated authority's assigned temple
 * GET /api/authority/announcements
 */
export const getAuthorityAnnouncements = async (req, res, next) => {
  try {
    const templeId = req.user.templeId;
    if (!templeId) {
      throw ApiError.forbidden('No temple assigned to this authority account');
    }

    const announcements = await TempleAnnouncement.find({ templeId })
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();

    return ApiResponse.success(
      res,
      announcements,
      'Temple announcements retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new announcement for the authenticated authority's assigned temple
 * POST /api/authority/announcements
 */
export const createAuthorityAnnouncement = async (req, res, next) => {
  try {
    const templeId = req.user.templeId;
    if (!templeId) {
      throw ApiError.forbidden('No temple assigned to this authority account');
    }

    const { title, message, type, expiresAt } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw ApiError.badRequest('Announcement title is required');
    }
    if (title.trim().length > 200) {
      throw ApiError.badRequest('Announcement title cannot exceed 200 characters');
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw ApiError.badRequest('Announcement message is required');
    }
    if (message.trim().length > 2000) {
      throw ApiError.badRequest('Announcement message cannot exceed 2000 characters');
    }

    const announcementType = type ? type.toUpperCase() : ANNOUNCEMENT_TYPES.GENERAL;
    if (!Object.values(ANNOUNCEMENT_TYPES).includes(announcementType)) {
      throw ApiError.badRequest(`Invalid announcement type. Allowed: ${Object.values(ANNOUNCEMENT_TYPES).join(', ')}`);
    }

    let parsedExpiresAt = null;
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime())) {
        throw ApiError.badRequest('Invalid expiresAt date format');
      }
      parsedExpiresAt = expDate;
    }

    // Security check: strictly bind templeId from authenticated session, ignoring any client body
    const announcement = await TempleAnnouncement.create({
      templeId,
      title: title.trim(),
      message: message.trim(),
      type: announcementType,
      isActive: true,
      publishedAt: new Date(),
      expiresAt: parsedExpiresAt,
      createdBy: req.user.userId,
    });

    return ApiResponse.created(
      res,
      announcement,
      'Announcement published successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update an announcement belonging to the authority's assigned temple
 * PATCH /api/authority/announcements/:id
 */
export const updateAuthorityAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const templeId = req.user.templeId;

    if (!templeId) {
      throw ApiError.forbidden('No temple assigned to this authority account');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid announcement ID');
    }

    const announcement = await TempleAnnouncement.findById(id);
    if (!announcement) {
      throw ApiError.notFound('Announcement not found');
    }

    // Strict tenant isolation check
    if (announcement.templeId.toString() !== templeId.toString()) {
      throw ApiError.forbidden('Tenant isolation policy: You can only modify announcements for your assigned temple');
    }

    const { title, message, type, expiresAt, isActive } = req.body;

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        throw ApiError.badRequest('Announcement title cannot be empty');
      }
      if (title.trim().length > 200) {
        throw ApiError.badRequest('Announcement title cannot exceed 200 characters');
      }
      announcement.title = title.trim();
    }

    if (message !== undefined) {
      if (!message || typeof message !== 'string' || !message.trim()) {
        throw ApiError.badRequest('Announcement message cannot be empty');
      }
      if (message.trim().length > 2000) {
        throw ApiError.badRequest('Announcement message cannot exceed 2000 characters');
      }
      announcement.message = message.trim();
    }

    if (type !== undefined) {
      const upperType = type.toUpperCase();
      if (!Object.values(ANNOUNCEMENT_TYPES).includes(upperType)) {
        throw ApiError.badRequest(`Invalid announcement type. Allowed: ${Object.values(ANNOUNCEMENT_TYPES).join(', ')}`);
      }
      announcement.type = upperType;
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        announcement.expiresAt = null;
      } else {
        const expDate = new Date(expiresAt);
        if (isNaN(expDate.getTime())) {
          throw ApiError.badRequest('Invalid expiresAt date format');
        }
        announcement.expiresAt = expDate;
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        throw ApiError.badRequest('isActive must be a boolean');
      }
      announcement.isActive = isActive;
    }

    await announcement.save();

    return ApiResponse.success(
      res,
      announcement,
      'Announcement updated successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an announcement belonging to the authority's assigned temple
 * DELETE /api/authority/announcements/:id
 */
export const deleteAuthorityAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const templeId = req.user.templeId;

    if (!templeId) {
      throw ApiError.forbidden('No temple assigned to this authority account');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid announcement ID');
    }

    const announcement = await TempleAnnouncement.findById(id);
    if (!announcement) {
      throw ApiError.notFound('Announcement not found');
    }

    // Strict tenant isolation check
    if (announcement.templeId.toString() !== templeId.toString()) {
      throw ApiError.forbidden('Tenant isolation policy: You can only delete announcements for your assigned temple');
    }

    await TempleAnnouncement.findByIdAndDelete(id);

    return ApiResponse.success(
      res,
      { id },
      'Announcement deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getAuthorityAnnouncements,
  createAuthorityAnnouncement,
  updateAuthorityAnnouncement,
  deleteAuthorityAnnouncement,
};
