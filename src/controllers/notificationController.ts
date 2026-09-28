import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

/**
 * Get Devotee / User Notifications
 * GET /api/notifications
 */
export const getMyNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const userId = req.user.userId;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return ApiResponse.success(
      res,
      {
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
      },
      'Notifications retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Mark Single Notification As Read
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const { id } = req.params;
    const userId = req.user.userId;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid notification ID format');
    }

    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) {
      throw ApiError.notFound('Notification not found or access denied');
    }

    notification.isRead = true;
    await notification.save();

    return ApiResponse.success(res, notification, 'Notification marked as read');
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Mark All Notifications As Read
 * PATCH /api/notifications/read-all
 */
export const markAllNotificationsAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const userId = req.user.userId;

    await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    return ApiResponse.success(res, null, 'All notifications marked as read');
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
