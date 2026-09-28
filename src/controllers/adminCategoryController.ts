import type { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { TempleCategory } from '../models/TempleCategory.js';
import { TempleCategorySuggestion, SUGGESTION_STATUS } from '../models/TempleCategorySuggestion.js';
import { Temple, TEMPLE_STATUS } from '../models/Temple.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

// Helper to slugify a category name
const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // Replace spaces and underscore with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};

interface CreateCategoryBody {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  image?: string;
  displayOrder?: number | string;
  isActive?: boolean;
}

interface UpdateCategoryBody {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  image?: string;
  displayOrder?: number | string;
  isActive?: boolean;
}

interface ToggleStatusBody {
  isActive?: boolean;
}

interface ReviewSuggestionBody {
  action?: string;
  rejectionReason?: string;
}

/**
 * Admin Create Category
 * POST /api/admin/categories
 */
export const createCategory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const { name, slug, description, icon, image, displayOrder, isActive } = req.body as CreateCategoryBody;

    if (!name || !name.trim()) {
      throw ApiError.badRequest('Category name is required');
    }

    const trimmedName = name.trim();
    const finalSlug = slug && slug.trim() ? generateSlug(slug.trim()) : generateSlug(trimmedName);

    if (!finalSlug) {
      throw ApiError.badRequest('Invalid category slug generated from name');
    }

    // Check for duplicate category name or slug (case-insensitive)
    const existing = await TempleCategory.findOne({
      $or: [
        { name: new RegExp(`^${trimmedName}$`, 'i') },
        { slug: finalSlug },
      ],
    });

    if (existing) {
      if (existing.slug === finalSlug) {
        throw ApiError.conflict(`A category with slug '${finalSlug}' already exists.`);
      }
      throw ApiError.conflict(`A category named '${trimmedName}' already exists.`);
    }

    const category = await TempleCategory.create({
      name: trimmedName,
      slug: finalSlug,
      description: description ? description.trim() : '',
      icon: icon ? icon.trim() : null,
      image: image ? image.trim() : null,
      displayOrder: displayOrder !== undefined ? Number(displayOrder) || 0 : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    return ApiResponse.created(res, category, 'Temple category created successfully');
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin List All Categories
 * GET /api/admin/categories
 */
export const getAdminCategories = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const categoriesWithCounts = await TempleCategory.aggregate([
      {
        $lookup: {
          from: 'temples',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$$categoryId', { $ifNull: ['$categories', []] }],
                },
              },
            },
            {
              $project: {
                _id: 1,
                status: 1,
              },
            },
          ],
          as: 'templeMatches',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          description: 1,
          icon: 1,
          image: 1,
          displayOrder: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          templeCount: { $size: '$templeMatches' },
          activeTempleCount: {
            $size: {
              $filter: {
                input: '$templeMatches',
                as: 't',
                cond: { $eq: ['$$t.status', TEMPLE_STATUS.ACTIVE] },
              },
            },
          },
        },
      },
      {
        $sort: { displayOrder: 1, name: 1, createdAt: 1 },
      },
    ]);

    return ApiResponse.success(
      res,
      categoriesWithCounts || [],
      'All temple categories retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Get Category by ID (with assigned temples list)
 * GET /api/admin/categories/:id
 */
export const getAdminCategoryById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid category ID');
    }

    const category = await TempleCategory.findById(id).lean();
    if (!category) {
      throw ApiError.notFound('Temple category not found');
    }

    const assignedTemples = await Temple.find({
      categories: id,
    })
      .select('name slug city state status templeType coverImage')
      .lean();

    return ApiResponse.success(
      res,
      {
        ...category,
        temples: assignedTemples || [],
        templeCount: assignedTemples.length,
      },
      'Category details retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Update Category
 * PATCH /api/admin/categories/:id
 */
export const updateCategory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid category ID');
    }

    const category = await TempleCategory.findById(id);
    if (!category) {
      throw ApiError.notFound('Temple category not found');
    }

    const { name, slug, description, icon, image, displayOrder, isActive } = req.body as UpdateCategoryBody;

    if (name !== undefined) {
      if (!name.trim()) throw ApiError.badRequest('Category name cannot be empty');
      const trimmedName = name.trim();
      const duplicate = await TempleCategory.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${trimmedName}$`, 'i'),
      });
      if (duplicate) {
        throw ApiError.conflict(`Another category with name '${trimmedName}' already exists`);
      }
      category.name = trimmedName;
    }

    if (slug !== undefined) {
      const finalSlug = generateSlug(slug);
      if (!finalSlug) throw ApiError.badRequest('Invalid slug provided');
      const duplicateSlug = await TempleCategory.findOne({
        _id: { $ne: id },
        slug: finalSlug,
      });
      if (duplicateSlug) {
        throw ApiError.conflict(`Another category with slug '${finalSlug}' already exists`);
      }
      category.slug = finalSlug;
    }

    if (description !== undefined) category.description = description.trim();
    if (icon !== undefined) category.icon = icon ? icon.trim() : null;
    if (image !== undefined) category.image = image ? image.trim() : null;
    if (displayOrder !== undefined) category.displayOrder = Number(displayOrder) || 0;
    if (isActive !== undefined) category.isActive = Boolean(isActive);

    category.updatedBy = req.user.userId;
    await category.save();

    return ApiResponse.success(res, category, 'Temple category updated successfully');
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Toggle Category Status (Activate / Deactivate)
 * PATCH /api/admin/categories/:id/status
 * Preserves existing temple relationships; hides/shows in public discovery.
 */
export const toggleCategoryStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid category ID');
    }

    const category = await TempleCategory.findById(id);
    if (!category) {
      throw ApiError.notFound('Temple category not found');
    }

    const { isActive } = req.body as ToggleStatusBody;
    category.isActive = isActive !== undefined ? Boolean(isActive) : !category.isActive;
    category.updatedBy = req.user.userId;
    await category.save();

    return ApiResponse.success(
      res,
      category,
      `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Assign Temple to Category
 * POST /api/admin/categories/:id/temples/:templeId
 */
export const assignTempleToCategory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id, templeId } = req.params;

    if (!id || !templeId || !mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid category or temple ID');
    }

    const [category, temple] = await Promise.all([
      TempleCategory.findById(id),
      Temple.findById(templeId),
    ]);

    if (!category) throw ApiError.notFound('Category not found');
    if (!temple) throw ApiError.notFound('Temple not found');

    await Temple.findByIdAndUpdate(templeId, {
      $addToSet: { categories: category._id },
    });

    const updatedTemple = await Temple.findById(templeId)
      .select('name slug categories city state status')
      .populate('categories', 'name slug');

    return ApiResponse.success(
      res,
      updatedTemple,
      `Temple '${temple.name}' assigned to category '${category.name}'`
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Remove Temple from Category
 * DELETE /api/admin/categories/:id/temples/:templeId
 */
export const removeTempleFromCategory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id, templeId } = req.params;

    if (!id || !templeId || !mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid category or temple ID');
    }

    const [category, temple] = await Promise.all([
      TempleCategory.findById(id),
      Temple.findById(templeId),
    ]);

    if (!category) throw ApiError.notFound('Category not found');
    if (!temple) throw ApiError.notFound('Temple not found');

    await Temple.findByIdAndUpdate(templeId, {
      $pull: { categories: category._id },
    });

    return ApiResponse.success(
      res,
      { categoryId: id, templeId },
      `Temple '${temple.name}' removed from category '${category.name}'`
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Get Category Suggestions
 * GET /api/admin/category-suggestions
 */
export const getCategorySuggestions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { status } = req.query as { status?: string };
    const filter: Record<string, unknown> = {};
    if (status && status.trim()) {
      filter.status = status.toUpperCase().trim();
    }

    const suggestions = await TempleCategorySuggestion.find(filter)
      .populate('templeId', 'name slug city state status')
      .populate('submittedBy', 'name email phone authorityDesignation')
      .populate('reviewedBy', 'name email')
      .populate('createdCategoryId', 'name slug isActive')
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponse.success(
      res,
      suggestions || [],
      'Category suggestions retrieved successfully'
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Review Category Suggestion
 * PATCH /api/admin/category-suggestions/:id
 * Supports:
 * - action: 'APPROVE' -> Finds existing or creates new TempleCategory, assigns to temple, marks APPROVED
 * - action: 'REJECT' -> Sets rejectionReason, marks REJECTED
 */
export const reviewCategorySuggestion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid suggestion ID');
    }

    const suggestion = await TempleCategorySuggestion.findById(id);
    if (!suggestion) {
      throw ApiError.notFound('Category suggestion not found');
    }

    if (suggestion.status !== SUGGESTION_STATUS.PENDING) {
      throw ApiError.badRequest(`Suggestion has already been ${suggestion.status.toLowerCase()}`);
    }

    const { action, rejectionReason } = req.body as ReviewSuggestionBody;
    if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
      throw ApiError.badRequest('Action must be either APPROVE or REJECT');
    }

    if (action.toUpperCase() === 'REJECT') {
      suggestion.status = SUGGESTION_STATUS.REJECTED;
      suggestion.rejectionReason = rejectionReason ? rejectionReason.trim() : 'Rejected by administrator';
      suggestion.reviewedBy = req.user.userId;
      suggestion.reviewedAt = new Date();
      await suggestion.save();

      return ApiResponse.success(res, suggestion, 'Category suggestion rejected');
    }

    // APPROVE flow:
    const trimmedName = suggestion.suggestedName.trim();
    const candidateSlug = generateSlug(trimmedName);

    // 1. Check if category already exists (case-insensitive name or slug)
    let category = await TempleCategory.findOne({
      $or: [
        { name: new RegExp(`^${trimmedName}$`, 'i') },
        { slug: candidateSlug },
      ],
    });

    // 2. If it does not exist, create it
    if (!category) {
      category = await TempleCategory.create({
        name: trimmedName,
        slug: candidateSlug,
        description: suggestion.description || '',
        isActive: true,
        createdBy: req.user.userId,
        updatedBy: req.user.userId,
      });
    }

    // 3. Assign category to the suggested temple
    await Temple.findByIdAndUpdate(suggestion.templeId, {
      $addToSet: { categories: category._id },
    });

    // 4. Update suggestion record
    suggestion.status = SUGGESTION_STATUS.APPROVED;
    suggestion.createdCategoryId = category._id;
    suggestion.reviewedBy = req.user.userId;
    suggestion.reviewedAt = new Date();
    await suggestion.save();

    return ApiResponse.success(
      res,
      {
        suggestion,
        category,
      },
      `Suggestion approved. Category '${category.name}' linked to temple.`
    );
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  createCategory,
  getAdminCategories,
  getAdminCategoryById,
  updateCategory,
  toggleCategoryStatus,
  assignTempleToCategory,
  removeTempleFromCategory,
  getCategorySuggestions,
  reviewCategorySuggestion,
};
