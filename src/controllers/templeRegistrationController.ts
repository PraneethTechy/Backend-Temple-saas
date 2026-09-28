import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { TempleRegistration, REGISTRATION_STATUS, TempleCategory } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

export interface SubmitRegistrationBody {
  applicantName?: string;
  applicantEmail?: string;
  applicantPhone?: string;
  authorityDesignation?: string;
  templeName?: string;
  templeType?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  mapUrl?: string | null;
  timings?: string;
  facilities?: string[] | string;
  guidelines?: string;
  documents?: unknown[];
  basicTempleImages?: unknown[];
  categoryIds?: string[];
  suggestedCategoryName?: string | null;
  suggestedCategoryDescription?: string | null;
}

/**
 * Public endpoint to submit a temple registration request.
 * Creates ONLY a TempleRegistration document with status = PENDING.
 * Strictly strips any client-provided status, review fields, or admin overrides.
 */
export const submitRegistration = async (
  req: Request<Record<string, never>, unknown, SubmitRegistrationBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const {
      applicantName,
      applicantEmail,
      applicantPhone,
      authorityDesignation,
      templeName,
      templeType = 'Traditional',
      description,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      mapUrl,
      timings,
      facilities,
      guidelines,
      documents = [],
      basicTempleImages = [],
      categoryIds = [],
      suggestedCategoryName = null,
      suggestedCategoryDescription = null,
    } = req.body;

    // Validation
    if (!applicantName || !applicantEmail || !applicantPhone || !authorityDesignation) {
      throw ApiError.badRequest('Applicant name, email, phone, and authority designation are required');
    }

    if (!templeName || !description || !address || !city || !state || !pincode) {
      throw ApiError.badRequest('Temple name, description, address, city, state, and pincode are required');
    }

    const normalizedEmail = applicantEmail.toLowerCase().trim();
    const normalizedTempleName = templeName.trim();

    // Duplicate protection: Check if an active application for this temple by this applicant already exists
    const existingActiveRegistration = await TempleRegistration.findOne({
      applicantEmail: normalizedEmail,
      templeName: new RegExp(`^${normalizedTempleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      status: { $in: [REGISTRATION_STATUS.PENDING, REGISTRATION_STATUS.UNDER_REVIEW] },
    });

    if (existingActiveRegistration) {
      throw ApiError.conflict(
        `A registration request for "${templeName}" under ${applicantEmail} is already ${existingActiveRegistration.status.toLowerCase().replace('_', ' ')}. Please await administrative review.`
      );
    }

    // Sanitize facilities into array if passed as string
    let parsedFacilities: string[] = [];
    if (Array.isArray(facilities)) {
      parsedFacilities = facilities.map((f) => String(f).trim()).filter(Boolean);
    } else if (typeof facilities === 'string' && facilities.trim()) {
      parsedFacilities = facilities.split(',').map((f) => f.trim()).filter(Boolean);
    }

    // Verify categoryIds
    let verifiedCategoryIds: mongoose.Types.ObjectId[] = [];
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      const validIds = [...new Set(categoryIds.map((c) => String(c).trim()).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
      if (validIds.length > 0) {
        const activeCats = await TempleCategory.find({
          _id: { $in: validIds },
          isActive: true,
        }).select('_id');
        verifiedCategoryIds = activeCats.map((c) => c._id as mongoose.Types.ObjectId);
      }
    }

    // Create registration (Status is ALWAYS forced to PENDING)
    const registration = new TempleRegistration({
      applicantName: applicantName.trim(),
      applicantEmail: normalizedEmail,
      applicantPhone: applicantPhone.trim(),
      authorityDesignation: authorityDesignation.trim(),
      templeName: normalizedTempleName,
      templeType: templeType.trim(),
      description: description.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      mapUrl: mapUrl ? mapUrl.trim() : null,
      timings: timings ? timings.trim() : '',
      facilities: parsedFacilities,
      guidelines: guidelines ? guidelines.trim() : '',
      documents: Array.isArray(documents) ? documents : [],
      basicTempleImages: Array.isArray(basicTempleImages) ? basicTempleImages : [],
      categoryIds: verifiedCategoryIds,
      suggestedCategoryName: suggestedCategoryName ? String(suggestedCategoryName).trim() : null,
      suggestedCategoryDescription: suggestedCategoryDescription ? String(suggestedCategoryDescription).trim() : null,
      status: REGISTRATION_STATUS.PENDING,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    });

    await registration.save();

    return ApiResponse.created(
      res,
      {
        registrationId: registration._id,
        templeName: registration.templeName,
        applicantEmail: registration.applicantEmail,
        status: registration.status,
        createdAt: registration.createdAt,
      },
      'Temple registration submitted successfully. Our administration team will review your application.'
    );
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  submitRegistration,
};
