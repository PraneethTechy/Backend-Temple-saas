import type { Request, Response, NextFunction } from 'express';
import { TempleCategory } from '../models/TempleCategory.js';
import { TempleCategorySuggestion } from '../models/TempleCategorySuggestion.js';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

interface CategorySuggestionBody {
  suggestedName?: string;
  description?: string;
}

/**
 * Public Category Discovery
 * GET /api/categories
 * Returns active categories with real-time active temple counts via MongoDB aggregation.
 */
export const getPublicCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const categoriesWithCount = await TempleCategory.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'temples',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$status', TEMPLE_STATUS.ACTIVE] },
                    { $in: ['$$categoryId', { $ifNull: ['$categories', []] }] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: 'activeTemples',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          description: 1,
          image: 1,
          icon: 1,
          displayOrder: 1,
          isActive: 1,
          templeCount: { $size: '$activeTemples' },
          createdAt: 1,
        },
      },
      {
        $sort: { displayOrder: 1, name: 1, createdAt: 1 },
      },
    ]);

    return ApiResponse.success(
      res,
      categoriesWithCount || [],
      'Active temple categories retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Public Category by Slug
 * GET /api/categories/:slug
 */
export const getPublicCategoryBySlug = async (
  req: Request<{ slug: string }>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { slug } = req.params;
    if (!slug) {
      throw ApiError.badRequest('Category slug is required');
    }

    const category = await TempleCategory.findOne({
      slug: slug.toLowerCase().trim(),
      isActive: true,
    }).lean();

    if (!category) {
      throw ApiError.notFound('Active temple category not found');
    }

    const templeCount = await Temple.countDocuments({
      status: TEMPLE_STATUS.ACTIVE,
      categories: category._id,
    });

    return ApiResponse.success(
      res,
      {
        ...category,
        templeCount,
      },
      'Category details retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Temple Authority Suggest Category
 * POST /api/authority/category-suggestions
 * Derives templeId strictly from req.user.templeId and submittedBy from req.user.userId
 */
export const submitCategorySuggestion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const templeId = req.user.templeId;
    if (!templeId) {
      throw ApiError.forbidden('No temple assigned to this authority account');
    }

    const { suggestedName, description } = req.body as CategorySuggestionBody;
    if (!suggestedName || !suggestedName.trim()) {
      throw ApiError.badRequest('Suggested category name is required');
    }

    const trimmedName = suggestedName.trim();
    if (trimmedName.length > 100) {
      throw ApiError.badRequest('Suggested name cannot exceed 100 characters');
    }

    const suggestion = await TempleCategorySuggestion.create({
      templeId,
      suggestedName: trimmedName,
      description: description ? description.trim() : '',
      submittedBy: req.user.userId,
      status: 'PENDING',
    });

    return ApiResponse.created(
      res,
      suggestion,
      'Category suggestion submitted successfully for administrator review'
    );
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  getPublicCategories,
  getPublicCategoryBySlug,
  submitCategorySuggestion,
};
