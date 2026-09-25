import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { SavedTemple } from '../models/SavedTemple.js';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Get Authenticated Devotee / User Profile
 * GET /api/users/profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId).select('-passwordHash -__v');
    if (!user) {
      throw ApiError.notFound('User profile not found');
    }

    return ApiResponse.success(res, user, 'Profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update Authenticated Devotee Profile
 * PATCH /api/users/profile
 * Allows updating name and phone only. Strictly protects role, templeId, isActive, and password.
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, phone } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User profile not found');
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        throw ApiError.badRequest('Name cannot be empty');
      }
      user.name = name.trim();
    }

    if (phone !== undefined) {
      user.phone = phone ? phone.trim() : '';
    }

    // Role, templeId, isActive, passwordHash, and email are strictly protected
    // and cannot be modified by devotee profile update
    await user.save();

    const sanitizedUser = await User.findById(userId).select('-passwordHash -__v');
    return ApiResponse.success(res, sanitizedUser, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated Devotee Saved Temples
 * GET /api/users/me/saved-temples
 * Returns list of active temples saved by the current devotee.
 */
export const getSavedTemples = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const savedRecords = await SavedTemple.find({ userId })
      .populate({
        path: 'templeId',
        match: { status: TEMPLE_STATUS.ACTIVE },
        select: 'name slug description templeType address city state coverImage timings gallery facilities parking',
      })
      .sort({ createdAt: -1 });

    // Filter out records where temple is no longer active or was removed
    const items = savedRecords
      .filter((record) => record.templeId)
      .map((record) => {
        const templeObj = record.templeId.toObject ? record.templeId.toObject() : record.templeId;
        return {
          ...templeObj,
          savedId: record._id,
          savedAt: record.createdAt,
          isSaved: true,
        };
      });

    return ApiResponse.success(
      res,
      {
        items,
        total: items.length,
      },
      'Saved temples retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Save Temple for Authenticated Devotee
 * POST /api/users/me/saved-temples/:templeId
 */
export const saveTemple = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { templeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID format');
    }

    // Verify temple exists and is publicly active
    const temple = await Temple.findOne({
      _id: templeId,
      status: TEMPLE_STATUS.ACTIVE,
    }).select('_id name');

    if (!temple) {
      throw ApiError.notFound('Sacred temple not found or not active');
    }

    // Check duplicate
    const existing = await SavedTemple.findOne({ userId, templeId });
    if (existing) {
      return ApiResponse.success(
        res,
        { isSaved: true, savedAt: existing.createdAt },
        'Temple is already saved'
      );
    }

    const saved = await SavedTemple.create({ userId, templeId });
    return ApiResponse.created(
      res,
      { isSaved: true, savedAt: saved.createdAt },
      'Sacred temple saved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unsave Temple for Authenticated Devotee
 * DELETE /api/users/me/saved-temples/:templeId
 */
export const unsaveTemple = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { templeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID format');
    }

    await SavedTemple.findOneAndDelete({ userId, templeId });

    return ApiResponse.success(
      res,
      { isSaved: false },
      'Temple removed from saved list'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Saved Status of a Single Temple for Authenticated Devotee
 * GET /api/users/me/saved-temples/:templeId/status
 */
export const getSavedTempleStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { templeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID format');
    }

    const exists = await SavedTemple.exists({ userId, templeId });

    return ApiResponse.success(
      res,
      { isSaved: Boolean(exists) },
      'Saved status retrieved'
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getProfile,
  updateProfile,
  getSavedTemples,
  saveTemple,
  unsaveTemple,
  getSavedTempleStatus,
};

