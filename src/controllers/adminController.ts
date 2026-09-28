import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import mongoose from 'mongoose';
import {
  Temple,
  TEMPLE_STATUS,
  TempleRegistration,
  REGISTRATION_STATUS,
  User,
  USER_ROLES,
  Booking,
  TempleCategory,
  TempleCategorySuggestion,
  Payment,
  PAYMENT_PROVIDERS,
  Review,
  REVIEW_STATUS,
  AuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  TempleRecommendation,
  RECOMMENDATION_STATUS,
  SiteReachMetric,
} from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { generateUniqueTempleSlug } from '../services/slugService.js';
import {
  createTempleAuthorityUser,
  validateStrongPassword,
  generateSecureTemporaryPassword,
} from '../services/authorityAuthService.js';
import { sendAuthorityCredentialEmail, sendEmail } from '../services/emailService.js';
import { sendAuthorityWelcomeCredentials } from '../services/credentialNotificationService.js';
import { logAuditActivity } from '../services/auditService.js';
import logger from '../utils/logger.js';

// ==========================================
// 1. DASHBOARD & KPIS
// ==========================================

export const getDashboardStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const [
      totalTemples,
      activeTemplesCount,
      pendingRegistrations,
      totalDevotees,
      totalAuthorities,
      recentRegistrations,
      templeStatusAgg,
      registrationsTrendAgg,
      templesByStateAgg,
      categoryDistributionAgg,
      recentBookingsTrendAgg,
      popularTemplesAgg,
    ] = await Promise.all([
      Temple.countDocuments(),
      Temple.countDocuments({ status: TEMPLE_STATUS.ACTIVE }),
      TempleRegistration.countDocuments({ status: REGISTRATION_STATUS.PENDING }),
      User.countDocuments({ role: USER_ROLES.DEVOTEE }),
      User.countDocuments({ role: USER_ROLES.TEMPLE_AUTHORITY }),
      TempleRegistration.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('templeName applicantName city state status createdAt')
        .lean(),
      Temple.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      TempleRegistration.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
      Temple.aggregate([
        { $match: { state: { $exists: true, $ne: '' } } },
        { $group: { _id: '$state', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      Temple.aggregate([
        { $unwind: '$categories' },
        {
          $lookup: {
            from: 'templecategories',
            localField: 'categories',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$cat.name',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
      Booking.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]),
      Booking.aggregate([
        { $group: { _id: '$templeId', bookingsCount: { $sum: 1 } } },
        { $sort: { bookingsCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'temples',
            localField: '_id',
            foreignField: '_id',
            as: 'temple',
          },
        },
        { $unwind: { path: '$temple', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            bookingsCount: 1,
            templeName: '$temple.name',
            city: '$temple.city',
          },
        },
      ]),
    ]);

    // Format status distribution
    const statusDistribution = {
      active: activeTemplesCount || 0,
      inactive: Math.max(0, (totalTemples || 0) - (activeTemplesCount || 0)),
      pending: pendingRegistrations || 0,
    };

    // Calculate real website reach for the last 7 days from SiteReachMetric
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDateStr = sevenDaysAgo.toISOString().slice(0, 10);
    const reachMetrics = await SiteReachMetric.find({ date: { $gte: startDateStr } }).lean();
    const reachMap = new Map();
    reachMetrics.forEach((m) => {
      reachMap.set(m.date, {
        visitors: m.visitorCount || m.uniqueVisitors?.length || 0,
        pageViews: m.pageViews || 0,
      });
    });

    const websiteReach = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const m = reachMap.get(dateStr) || { visitors: 0, pageViews: 0 };
      const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      websiteReach.push({
        date: dateStr,
        label,
        visitors: m.visitors,
        pageViews: m.pageViews,
      });
    }

    return ApiResponse.success(
      res,
      {
        kpis: {
          totalTemples: totalTemples || 0,
          activeTemples: activeTemplesCount || 0,
          pendingRegistrations: pendingRegistrations || 0,
          totalDevotees: totalDevotees || 0,
          totalAuthorities: totalAuthorities || 0,
        },
        recentRegistrations: recentRegistrations || [],
        statusDistribution,
        websiteReach,
        registrationsTrend: (registrationsTrendAgg || []).map((item) => ({
          period: item._id,
          count: item.count,
        })),
        templesByState: (templesByStateAgg || []).map((item) => ({
          state: item._id,
          count: item.count,
        })),
        categoryDistribution: (categoryDistributionAgg || []).map((item) => ({
          category: item._id || 'Unassigned',
          count: item.count,
        })),
        bookingsTrend: (recentBookingsTrendAgg || []).map((item) => ({
          date: item._id,
          count: item.count,
          revenue: item.revenue || 0,
        })),
        popularTemples: popularTemplesAgg || [],
      },
      'Admin dashboard metrics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. TEMPLE REGISTRATIONS MANAGEMENT
// ==========================================

export const getTempleRegistrations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { status, search } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { templeName: searchRegex },
        { applicantName: searchRegex },
        { applicantEmail: searchRegex },
        { city: searchRegex },
      ];
    }

    const [total, registrations] = await Promise.all([
      TempleRegistration.countDocuments(query),
      TempleRegistration.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reviewedBy', 'name email')
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        registrations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Temple registrations retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getTempleRegistrationById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid registration ID');
    }

    const registration = await TempleRegistration.findById(id)
      .populate('reviewedBy', 'name email role')
      .populate('categoryIds', 'name slug isActive')
      .lean();

    if (!registration) {
      throw ApiError.notFound('Temple registration not found');
    }

    return ApiResponse.success(res, registration, 'Temple registration details retrieved');
  } catch (error) {
    next(error);
  }
};

export const updateRegistrationStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid registration ID');
    }

    const registration = await TempleRegistration.findById(id);
    if (!registration) {
      throw ApiError.notFound('Temple registration not found');
    }

    // Controlled transitions
    if (status === REGISTRATION_STATUS.UNDER_REVIEW) {
      if (registration.status !== REGISTRATION_STATUS.PENDING) {
        throw ApiError.badRequest(`Cannot move registration to UNDER_REVIEW from ${registration.status}`);
      }
      registration.status = REGISTRATION_STATUS.UNDER_REVIEW;
      await registration.save();

      return ApiResponse.success(
        res,
        registration,
        'Temple registration status updated to UNDER_REVIEW'
      );
    }

    if (status === REGISTRATION_STATUS.APPROVED) {
      throw ApiError.badRequest('Please use the dedicated approval endpoint (/approve) to onboard the temple.');
    }

    if (status === REGISTRATION_STATUS.REJECTED) {
      throw ApiError.badRequest('Please use the dedicated rejection endpoint (/reject) with a valid reason.');
    }

    throw ApiError.badRequest(`Unsupported status transition: ${status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * Coordinated Atomic Approval Workflow
 * - Verifies eligibility (PENDING or UNDER_REVIEW)
 * - Prevents re-approval (Idempotency)
 * - Creates Temple (ACTIVE, unique slug)
 * - Creates User (TEMPLE_AUTHORITY, temporary password, mustChangePassword: true)
 * - Approves registration and creates the Temple document
 * - Optionally provisions authority and dispatches credentials email if temporaryPassword is provided
 */
export const approveRegistration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  let session = null;
  let useTransactions = false;
  let createdTemple = null;
  let createdAuthority = null;

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid registration ID');
    }

    // 1. Initial validation
    const registration = await TempleRegistration.findById(id);
    if (!registration) {
      throw ApiError.notFound('Temple registration not found');
    }

    // Re-approval protection (Strict Idempotency)
    if (registration.status === REGISTRATION_STATUS.APPROVED) {
      throw ApiError.conflict('This registration has already been approved and onboarding is complete.');
    }

    if (registration.status === REGISTRATION_STATUS.REJECTED) {
      throw ApiError.badRequest('Cannot approve a registration that has already been rejected.');
    }

    // Determine if MongoDB replica set / transactions are supported
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransactions = true;
    } catch (err: any) {
      logger.warn(`[AdminController] MongoDB transactions not supported in this environment: ${err.message}. Proceeding with coordinated execution.`);
      session = null;
      useTransactions = false;
    }

    const sessionOption = useTransactions ? { session: session || undefined } : {};

    // 2. Generate unique slug
    const uniqueSlug = await generateUniqueTempleSlug(
      registration.templeName,
      registration.city,
      sessionOption
    );

    // 3. Create Temple Document
    const temple = new Temple({
      name: registration.templeName,
      slug: uniqueSlug,
      description: registration.description,
      templeType: registration.templeType || 'Heritage',
      address: registration.address,
      city: registration.city,
      state: registration.state,
      pincode: registration.pincode,
      latitude: registration.latitude || null,
      longitude: registration.longitude || null,
      mapUrl: registration.mapUrl || null,
      facilities: registration.facilities || [],
      guidelines: registration.guidelines ? [registration.guidelines] : [],
      status: TEMPLE_STATUS.ACTIVE,
      timings: {
        specialNotes: registration.timings || '',
      },
    });

    await temple.save(sessionOption);
    createdTemple = temple;

    // Re-query registration.categoryIds from MongoDB to ensure they are valid and active
    if (Array.isArray(registration.categoryIds) && registration.categoryIds.length > 0) {
      const activeCats = await TempleCategory.find(
        {
          _id: { $in: registration.categoryIds },
          isActive: true,
        },
        '_id',
        sessionOption
      );
      temple.categories = activeCats.map((c) => c._id);
      await temple.save(sessionOption);
    }

    // Preserve category suggestion if provided: create PENDING TempleCategorySuggestion
    if (registration.suggestedCategoryName && registration.suggestedCategoryName.trim()) {
      await TempleCategorySuggestion.create(
        [
          {
            templeId: temple._id,
            suggestedName: registration.suggestedCategoryName.trim(),
            description: registration.suggestedCategoryDescription
              ? registration.suggestedCategoryDescription.trim()
              : '',
            submittedBy: req.user?.userId || (req.user as any)?._id || req.user?.id,
            status: 'PENDING',
          },
        ],
        sessionOption
      );
    }

    // 4. Check if authority creation is requested directly with approval
    const shouldCreateAuthority = Boolean(
      req.body && (req.body.temporaryPassword || req.body.createAuthority)
    );

    let generatedPassForEmail = null;

    if (shouldCreateAuthority) {
      const existingUser = await User.findOne({ email: registration.applicantEmail.toLowerCase() }, null, sessionOption);
      if (existingUser) {
        throw ApiError.conflict(
          `An account already exists for ${registration.applicantEmail}. Cannot provision authority account.`
        );
      }

      const { user: authorityUser, temporaryPassword } = await createTempleAuthorityUser(
        {
          name: registration.applicantName,
          email: registration.applicantEmail,
          phone: registration.applicantPhone,
          templeId: temple._id,
          temporaryPassword: req.body.temporaryPassword,
        },
        sessionOption
      );
      createdAuthority = authorityUser;
      generatedPassForEmail = temporaryPassword;

      temple.authorityId = authorityUser._id;
      await temple.save(sessionOption);
    }

    // 5. Update Temple Registration
    registration.status = REGISTRATION_STATUS.APPROVED;
    registration.createdTempleId = temple._id;
    registration.reviewedBy = (req.user?.userId || (req.user as any)?._id || req.user?.id) as any;
    registration.reviewedAt = new Date();
    await registration.save(sessionOption);

    // Commit transaction if active
    if (useTransactions && session) {
      await session.commitTransaction();
      session.endSession();
    }

    // 6. If authority was created, attempt to send credentials email without breaking approval
    let emailResult = null;
    if (shouldCreateAuthority && generatedPassForEmail) {
      emailResult = await sendAuthorityCredentialEmail({
        email: registration.applicantEmail,
        name: registration.applicantName,
        templeName: registration.templeName,
        username: registration.applicantEmail,
        temporaryPassword: generatedPassForEmail,
      });

      if (!emailResult.success) {
        logger.warn(
          `[AdminController] Temple approved and authority account created, but credentials email could not be delivered (${emailResult.status}): ${emailResult.error}`
        );
      }
    }

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action: AUDIT_ACTIONS.TEMPLE_APPROVED,
      entityType: AUDIT_ENTITY_TYPES.TEMPLE,
      entityId: temple._id,
      description: `Approved temple registration for "${temple.name}" in ${temple.city}, ${temple.state}`,
      metadata: { registrationId: registration._id, templeName: temple.name },
    });

    let approvalMessage = 'Temple registration approved successfully. Ready for authority credential creation.';
    if (shouldCreateAuthority) {
      if (emailResult?.success) {
        approvalMessage = 'Temple approved and authority account created. Credentials emailed successfully.';
      } else if (emailResult?.status === 'INVALID_EMAIL') {
        approvalMessage = 'Temple approved and authority account created. The email address has invalid syntax, so credentials were not emailed.';
      } else {
        approvalMessage = `Temple approved and authority account created, but the credential email could not be delivered (${emailResult?.status || 'EMAIL_FAILED'}). You can use Resend Credentials at any time.`;
      }
    }

    return ApiResponse.success(
      res,
      {
        registrationId: registration._id,
        temple: {
          id: temple._id,
          name: temple.name,
          slug: temple.slug,
          status: temple.status,
          city: temple.city,
          state: temple.state,
          authorityId: temple.authorityId || null,
        },
        authority: createdAuthority
          ? {
              id: createdAuthority._id,
              name: createdAuthority.name,
              email: createdAuthority.email,
              role: createdAuthority.role,
              mustChangePassword: true,
            }
          : null,
        emailDelivery: emailResult
          ? {
              success: emailResult.success,
              status: emailResult.status,
              error: emailResult.error || null,
            }
          : null,
        status: registration.status,
      },
      approvalMessage
    );
  } catch (error) {
    // Rollback transaction if active
    if (useTransactions && session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (abortErr: any) {
        logger.error(`[AdminController] Error aborting transaction: ${abortErr.message}`);
      }
    } else {
      // Manual cleanup if non-transactional standalone failed midway
      if (createdAuthority?._id) {
        await User.findByIdAndDelete(createdAuthority._id).catch(() => {});
      }
      if (createdTemple?._id) {
        await Temple.findByIdAndDelete(createdTemple._id).catch(() => {});
      }
    }

    next(error);
  }
};

/**
 * Dedicated Admin endpoint to provision authority credentials and send credentials email
 * for an already-approved TempleRegistration.
 * Route: POST /api/admin/temple-registrations/:id/create-authority
 */
export const createAuthorityForRegistration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  let createdAuthority = null;
  let temple = null;

  try {
    const { id } = req.params;
    const { username, temporaryPassword: inputPassword } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid registration ID');
    }

    const registration = await TempleRegistration.findById(id);
    if (!registration) {
      throw ApiError.notFound('Temple registration not found');
    }

    if (registration.status !== REGISTRATION_STATUS.APPROVED) {
      throw ApiError.badRequest(
        `Registration must be approved before creating an authority account. Current status: ${registration.status}`
      );
    }

    // Locate the approved temple record
    if (registration.createdTempleId) {
      temple = await Temple.findById(registration.createdTempleId);
    }
    if (!temple) {
      temple = await Temple.findOne({
        name: registration.templeName,
        city: registration.city,
      });
    }
    if (!temple) {
      throw ApiError.notFound('Associated temple record not found for this registration.');
    }

    // Duplicate protection: Verify temple does not already have an authority
    if (temple.authorityId) {
      throw ApiError.conflict('Temple authority account already exists for this temple.');
    }

    const targetEmail = (username || registration.applicantEmail).toLowerCase().trim();

    // Duplicate protection: Verify user email is not already taken
    const existingUser = await User.findOne({
      $or: [{ email: targetEmail }, { templeId: temple._id }],
    });
    if (existingUser) {
      throw ApiError.conflict('Temple authority account already exists for this temple or email.');
    }

    // Validate or generate temporary password
    let temporaryPassword = inputPassword;
    if (temporaryPassword) {
      const { isValid, message } = validateStrongPassword(temporaryPassword);
      if (!isValid) {
        throw ApiError.badRequest(`Temporary password policy violation: ${message}`);
      }
    } else {
      temporaryPassword = generateSecureTemporaryPassword();
    }

    // Provision the authority user
    const { user: authorityUser } = await createTempleAuthorityUser({
      name: registration.applicantName,
      email: targetEmail,
      phone: registration.applicantPhone,
      templeId: temple._id,
      temporaryPassword,
    });
    createdAuthority = authorityUser;

    // Link temple to authority
    temple.authorityId = authorityUser._id;
    await temple.save();

    // Send credentials via Nodemailer email service
    const emailResult = await sendAuthorityCredentialEmail({
      email: targetEmail,
      name: registration.applicantName,
      templeName: temple.name,
      username: targetEmail,
      temporaryPassword,
    });

    if (!emailResult.success) {
      logger.warn(
        `[AdminController] Authority account created, but credentials email failed (${emailResult.status}): ${emailResult.error}`
      );
    }

    let message = 'Temple authority account created and credentials sent successfully.';
    if (!emailResult.success) {
      if (emailResult.status === 'INVALID_EMAIL') {
        message = 'Temple authority account created. The email address has invalid syntax, so credentials were not emailed.';
      } else {
        message = `Temple authority account created. Note: Credentials email could not be delivered (${emailResult.status}). You can use Resend Credentials at any time.`;
      }
    }

    // Return safe response: NEVER return plaintext temporaryPassword or passwordHash
    return ApiResponse.success(
      res,
      {
        templeId: temple._id,
        templeName: temple.name,
        authority: {
          id: authorityUser._id,
          name: authorityUser.name,
          email: authorityUser.email,
          role: authorityUser.role,
          mustChangePassword: true,
        },
        emailDelivery: {
          success: emailResult.success,
          status: emailResult.status,
          error: emailResult.error || null,
        },
      },
      message
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin action to regenerate a temporary password and resend credentials email
 * to an existing Temple Authority.
 * Route: POST /api/admin/temple-registrations/:id/resend-credentials
 */
export const resendAuthorityCredentials = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { temporaryPassword: inputPassword } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid registration ID');
    }

    const registration = await TempleRegistration.findById(id);
    if (!registration) {
      throw ApiError.notFound('Temple registration not found');
    }

    let temple = null;
    if (registration.createdTempleId) {
      temple = await Temple.findById(registration.createdTempleId);
    }
    if (!temple) {
      temple = await Temple.findOne({
        name: registration.templeName,
        city: registration.city,
      });
    }
    if (!temple || !temple.authorityId) {
      throw ApiError.badRequest('No authority account exists for this temple yet. Please create one first.');
    }

    const authorityUser = await User.findById(temple.authorityId);
    if (!authorityUser) {
      throw ApiError.notFound('Assigned authority user record not found.');
    }

    // Generate new strong temporary password or validate input
    let newTemporaryPassword = inputPassword;
    if (newTemporaryPassword) {
      const { isValid, message } = validateStrongPassword(newTemporaryPassword);
      if (!isValid) {
        throw ApiError.badRequest(`Temporary password policy violation: ${message}`);
      }
    } else {
      newTemporaryPassword = generateSecureTemporaryPassword();
    }

    const previousPasswordHash = authorityUser.password;

    // Update authority password and set mustChangePassword = true
    authorityUser.password = newTemporaryPassword;
    authorityUser.mustChangePassword = true;
    await authorityUser.save();

    // Send new credentials email
    const emailResult = await sendAuthorityCredentialEmail({
      email: authorityUser.email,
      name: authorityUser.name,
      templeName: temple.name,
      username: authorityUser.email,
      temporaryPassword: newTemporaryPassword,
    });

    if (!emailResult.success) {
      logger.warn(
        `[AdminController] Resend email failed (${emailResult.status}): ${emailResult.error}`
      );
      // Revert password back to previous hash so the authority is not locked out with an unreceived password
      authorityUser.password = previousPasswordHash;
      await authorityUser.save().catch(() => {});

      return res.status(400).json({
        success: false,
        status: emailResult.status,
        code: emailResult.code || null,
        message: `Failed to deliver credentials email (${emailResult.status}): ${emailResult.error || 'Recipient unreachable'}. Password was not updated.`,
      });
    }

    return ApiResponse.success(
      res,
      {
        emailDelivery: {
          success: true,
          status: 'SENT',
          messageId: emailResult.messageId,
        },
      },
      'New credentials generated and sent to registered email successfully.'
    );
  } catch (error) {
    next(error);
  }
};

export const rejectRegistration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid registration ID');
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      throw ApiError.badRequest('Rejection reason is mandatory to reject a temple application');
    }

    const registration = await TempleRegistration.findById(id);
    if (!registration) {
      throw ApiError.notFound('Temple registration not found');
    }

    if (registration.status === REGISTRATION_STATUS.APPROVED) {
      throw ApiError.badRequest('Cannot reject an already approved temple registration');
    }

    registration.status = REGISTRATION_STATUS.REJECTED;
    registration.rejectionReason = rejectionReason.trim();
    registration.reviewedBy = (req.user?.userId || (req.user as any)?._id || req.user?.id) as any;
    registration.reviewedAt = new Date();

    await registration.save();

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action: AUDIT_ACTIONS.TEMPLE_REJECTED,
      entityType: AUDIT_ENTITY_TYPES.TEMPLE_REGISTRATION,
      entityId: registration._id,
      description: `Rejected temple registration for "${registration.templeName}". Reason: ${registration.rejectionReason}`,
      metadata: { registrationId: registration._id, reason: registration.rejectionReason },
    });

    return ApiResponse.success(
      res,
      {
        registrationId: registration._id,
        status: registration.status,
        rejectionReason: registration.rejectionReason,
        reviewedAt: registration.reviewedAt,
      },
      'Temple registration rejected successfully'
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. TEMPLES MANAGEMENT
// ==========================================

export const getTemples = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { status, search, city } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (city && city.trim()) {
      query.city = new RegExp(city.trim(), 'i');
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { city: searchRegex }, { state: searchRegex }];
    }

    const [total, temples] = await Promise.all([
      Temple.countDocuments(query),
      Temple.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('authorityId', 'name email phone isActive')
        .populate('categories', 'name slug isActive')
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        temples,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Temples list retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getTempleById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid temple ID');
    }

    const temple = await Temple.findById(id)
      .populate('authorityId', 'name email phone isActive lastLoginAt')
      .populate('categories', 'name slug isActive')
      .lean();

    if (!temple) {
      throw ApiError.notFound('Temple not found');
    }

    // Placeholders for services and bookings count for Phase 4
    const templeDetails = {
      ...temple,
      servicesCount: 0,
      bookingsCount: 0,
    };

    return ApiResponse.success(res, templeDetails, 'Temple details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateTempleStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid temple ID');
    }

    if (![TEMPLE_STATUS.ACTIVE, TEMPLE_STATUS.INACTIVE].includes(status)) {
      throw ApiError.badRequest(`Invalid temple status. Allowed: ${TEMPLE_STATUS.ACTIVE}, ${TEMPLE_STATUS.INACTIVE}`);
    }

    const temple = await Temple.findById(id);
    if (!temple) {
      throw ApiError.notFound('Temple not found');
    }

    temple.status = status;
    await temple.save();

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action: AUDIT_ACTIONS.TEMPLE_STATUS_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.TEMPLE,
      entityId: temple._id,
      description: `Updated status for temple "${temple.name}" to ${temple.status}`,
      metadata: { status: temple.status },
    });

    return ApiResponse.success(
      res,
      { id: temple._id, status: temple.status, name: temple.name },
      `Temple status successfully changed to ${temple.status}`
    );
  } catch (error) {
    next(error);
  }
};

export const updateTempleCategories = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { categories } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid temple ID');
    }

    if (!Array.isArray(categories)) {
      throw ApiError.badRequest('Categories must be an array of category IDs');
    }

    const temple = await Temple.findById(id);
    if (!temple) throw ApiError.notFound('Temple not found');

    const uniqueCategoryIds = [...new Set(categories.map((c) => String(c).trim()).filter(Boolean))];

    if (uniqueCategoryIds.length > 0) {
      for (const catId of uniqueCategoryIds) {
        if (!mongoose.Types.ObjectId.isValid(catId)) {
          throw ApiError.badRequest(`Invalid category ID format: ${catId}`);
        }
      }

      const validCats = await TempleCategory.find({
        _id: { $in: uniqueCategoryIds },
      }).select('_id name isActive');

      if (validCats.length !== uniqueCategoryIds.length) {
        throw ApiError.badRequest('One or more selected categories do not exist');
      }

      const inactiveCat = validCats.find((c) => !c.isActive);
      if (inactiveCat) {
        throw ApiError.badRequest(`Cannot assign inactive category "${inactiveCat.name}"`);
      }

      temple.categories = uniqueCategoryIds as any;
    } else {
      temple.categories = [];
    }

    await temple.save();

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action: AUDIT_ACTIONS.CATEGORY_TEMPLE_ASSIGNED,
      entityType: AUDIT_ENTITY_TYPES.TEMPLE,
      entityId: temple._id,
      description: `Updated deity / category assignment for temple "${temple.name}"`,
      metadata: { categories: temple.categories },
    });

    const updatedTemple = await Temple.findById(id)
      .populate('categories', 'name slug isActive')
      .populate('authorityId', 'name email phone isActive')
      .lean();

    return ApiResponse.success(res, updatedTemple, 'Temple categories updated successfully');
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. TEMPLE AUTHORITIES MANAGEMENT
// ==========================================

export const getAuthorities = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { search, status } = req.query as Record<string, any>;

    const query: Record<string, any> = { role: USER_ROLES.TEMPLE_AUTHORITY };

    if (status && status !== 'ALL') {
      query.isActive = status === 'ACTIVE';
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const [total, authorities] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('templeId', 'name slug city state status')
        .select('-password')
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        authorities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Temple authorities retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. USERS MANAGEMENT
// ==========================================

export const getUsers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { role, status, search } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (role && role !== 'ALL') {
      query.role = role.toUpperCase();
    }

    if (status && status !== 'ALL') {
      query.isActive = status === 'ACTIVE';
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-password')
        .populate('templeId', 'name city')
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Users retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid user ID');
    }

    if (typeof isActive !== 'boolean') {
      throw ApiError.badRequest('isActive must be a boolean');
    }

    // Self-deactivation protection: Admin cannot deactivate their own account
    if (String(req.user?.userId || (req.user as any)?._id || req.user?.id) === id.toString() && isActive === false) {
      throw ApiError.badRequest('Security policy prevents administrators from deactivating their own account');
    }

    const user = await User.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    user.isActive = isActive;
    await user.save();

    return ApiResponse.success(
      res,
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      `User account ${user.isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. DEVOTEES MANAGEMENT
 * Dedicated endpoint for devotee user supervision with booking counts
 * GET /api/admin/devotees
 */
export const getAdminDevotees = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { status, search } = req.query as Record<string, any>;

    const query: Record<string, any> = { role: USER_ROLES.DEVOTEE };

    if (status && status !== 'ALL') {
      query.isActive = status === 'ACTIVE';
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    const [total, devotees] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-password')
        .lean(),
    ]);

    // Compute booking count for each devotee efficiently in one aggregation
    const devoteeIds = devotees.map((d) => d._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { userId: { $in: devoteeIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, any> = {};
    bookingCounts.forEach((bc) => {
      countMap[bc._id.toString()] = bc.count;
    });

    const devoteesWithCounts = devotees.map((d) => ({
      ...d,
      bookingCount: countMap[d._id.toString()] || 0,
    }));

    return ApiResponse.success(
      res,
      {
        devotees: devoteesWithCounts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Devotees retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Devotee status (strictly restricted to DEVOTEE role)
 * PATCH /api/admin/devotees/:id/status
 */
export const updateDevoteeStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid devotee ID');
    }

    if (typeof isActive !== 'boolean') {
      throw ApiError.badRequest('isActive must be a boolean');
    }

    const user = await User.findById(id);
    if (!user) {
      throw ApiError.notFound('Devotee user not found');
    }

    // Strict security check: this endpoint can only modify DEVOTEE accounts
    if (user.role !== USER_ROLES.DEVOTEE) {
      throw ApiError.forbidden('This endpoint can only modify DEVOTEE accounts.');
    }

    user.isActive = isActive;
    await user.save();

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action: AUDIT_ACTIONS.DEVOTEE_STATUS_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.DEVOTEE,
      entityId: user._id,
      description: `${isActive ? 'Activated' : 'Deactivated'} devotee account for "${user.name}" (${user.email})`,
      metadata: { devoteeId: user._id, email: user.email, isActive },
    });

    return ApiResponse.success(
      res,
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      `Devotee account ${user.isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 7. BOOKINGS SUPERVISION
 * Get All Bookings Across Temples (Admin Supervisory Visibility)
 * GET /api/admin/bookings
 */
export const getAdminBookings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { search, status, templeId, paymentStatus, date, startDate, endDate } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (status && String(status).toUpperCase() !== 'ALL') {
      query.bookingStatus = String(status).toUpperCase();
    }

    if (paymentStatus && String(paymentStatus).toUpperCase() !== 'ALL') {
      query.paymentStatus = String(paymentStatus).toUpperCase();
    }

    if (templeId && mongoose.Types.ObjectId.isValid(templeId as any)) {
      query.templeId = templeId;
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.bookingReference = searchRegex;
    }

    if (date) {
      const d = new Date(date as string);
      if (!isNaN(d.getTime())) {
        const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        query.bookingDate = { $gte: startOfDay, $lte: endOfDay };
      }
    } else if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) {
        const s = new Date(startDate as string);
        if (!isNaN(s.getTime())) query.bookingDate.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate as string);
        if (!isNaN(e.getTime())) {
          e.setHours(23, 59, 59, 999);
          query.bookingDate.$lte = e;
        }
      }
    }

    const [total, rawBookings] = await Promise.all([
      Booking.countDocuments(query),
      Booking.find(query)
        .populate('templeId', 'name city state slug')
        .populate('serviceId', 'name type price duration')
        .populate('timeSlotId', 'startTime endTime')
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const bookings = rawBookings.map((b) => b.toMaskedJSON());

    return ApiResponse.success(
      res,
      {
        bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Admin bookings retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 8. PAYMENTS MONITORING & RECONCILIATION
 * GET /api/admin/payments
 */
export const getAdminPayments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { status, templeId, search, date } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (status && String(status).toUpperCase() !== 'ALL') {
      query.status = String(status).toUpperCase();
    }

    if (templeId && mongoose.Types.ObjectId.isValid(templeId as any)) {
      query.templeId = templeId;
    }

    if (date) {
      const d = new Date(date as string);
      if (!isNaN(d.getTime())) {
        const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
      }
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.$or = [
        { providerPaymentId: searchRegex },
        { providerOrderId: searchRegex },
      ];
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(query),
      Payment.find(query)
        .populate('bookingId', 'bookingReference totalAmount bookingDate bookingStatus')
        .populate('userId', 'name email phone')
        .populate('templeId', 'name city state')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Admin payments retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 9. FEEDBACK & REVIEWS
 * GET /api/admin/reviews
 */
export const getAdminReviews = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;
    const { status, templeId, rating, search } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (status && String(status).toUpperCase() !== 'ALL') {
      query.status = String(status).toUpperCase();
    }

    if (templeId && mongoose.Types.ObjectId.isValid(templeId as any)) {
      query.templeId = templeId;
    }

    if (rating && !isNaN(parseInt(rating as string, 10))) {
      query.rating = parseInt(rating as string, 10);
    }

    if (search && String(search).trim()) {
      query.comment = new RegExp(String(search).trim(), 'i');
    }

    const [total, reviews] = await Promise.all([
      Review.countDocuments(query),
      Review.find(query)
        .populate('userId', 'name email')
        .populate('templeId', 'name city slug')
        .populate('bookingId', 'bookingReference')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Admin reviews retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/reviews/metrics
 */
export const getAdminReviewMetrics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, pending, approved, thisMonth, ratingAgg] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ status: REVIEW_STATUS.PENDING }),
      Review.countDocuments({ status: REVIEW_STATUS.APPROVED }),
      Review.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Review.aggregate([
        { $match: { status: REVIEW_STATUS.APPROVED } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
    ]);

    const averageRating =
      ratingAgg.length > 0 && ratingAgg[0].avgRating
        ? Number(ratingAgg[0].avgRating.toFixed(1))
        : 0;

    return ApiResponse.success(
      res,
      {
        total,
        pending,
        approved,
        averageRating,
        thisMonth,
      },
      'Review metrics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/reviews/:id/status
 */
export const updateAdminReviewStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid review ID');
    }

    if (![REVIEW_STATUS.APPROVED, REVIEW_STATUS.REJECTED].includes(status)) {
      throw ApiError.badRequest(
        `Invalid review status. Allowed: ${REVIEW_STATUS.APPROVED}, ${REVIEW_STATUS.REJECTED}`
      );
    }

    const review = await Review.findById(id).populate('templeId', 'name');
    if (!review) {
      throw ApiError.notFound('Review not found');
    }

    review.status = status;
    await review.save();

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action:
        status === REVIEW_STATUS.APPROVED
          ? AUDIT_ACTIONS.REVIEW_APPROVED
          : AUDIT_ACTIONS.REVIEW_REJECTED,
      entityType: AUDIT_ENTITY_TYPES.REVIEW,
      entityId: review._id,
      description: `${status === REVIEW_STATUS.APPROVED ? 'Approved' : 'Rejected'} review for temple "${
        (review.templeId as any)?.name || review.templeId
      }"`,
      metadata: { reviewId: review._id, status },
    });

    return ApiResponse.success(
      res,
      { id: review._id, status: review.status },
      `Review status successfully updated to ${review.status}`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/reviews/insights/:templeId
 */
export const getAdminTempleReviewInsights = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID');
    }

    const temple = await Temple.findById(templeId).select('name city state').lean();
    if (!temple) {
      throw ApiError.notFound('Temple not found');
    }

    const approvedReviews = await Review.find({
      templeId,
      status: REVIEW_STATUS.APPROVED,
    })
      .select('rating comment createdAt')
      .lean();

    const totalApproved = approvedReviews.length;
    const avgRating =
      totalApproved > 0
        ? Number(
            (
              approvedReviews.reduce((sum, r) => sum + r.rating, 0) / totalApproved
            ).toFixed(1)
          )
        : 0;

    // Operational topic detectors
    const topicPatterns = [
      { name: 'Queue / Waiting', regex: /\b(queue|waiting|wait|crowd|line|delay)\b/i },
      { name: 'Parking', regex: /\b(parking|park|vehicle|car|bike)\b/i },
      {
        name: 'Facilities & Cleanliness',
        regex: /\b(facility|facilities|restroom|water|clean|toilet|amenity)\b/i,
      },
      {
        name: 'Staff assistance',
        regex: /\b(staff|assistance|guide|priest|pandit|sevadar|helpful)\b/i,
      },
      {
        name: 'Darshan experience',
        regex: /\b(darshan|peace|peaceful|blessing|spiritual|sanctum)\b/i,
      },
    ];

    const topics = topicPatterns
      .map((tp) => {
        const mentions = approvedReviews.filter((r) => tp.regex.test(r.comment)).length;
        return {
          topic: tp.name,
          mentions,
        };
      })
      .sort((a, b) => b.mentions - a.mentions);

    return ApiResponse.success(
      res,
      {
        temple,
        averageRating: avgRating,
        totalReviews: totalApproved,
        insightLabel: 'Recurring topics detected from approved review comments',
        topics,
      },
      'Temple review insights retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 10. TEMPLE RECOMMENDATIONS
 * POST /api/admin/recommendations
 */
export const createAdminTempleRecommendation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId, title, category, observedFeedback, suggestedAction } = req.body;

    if (!mongoose.Types.ObjectId.isValid(templeId)) {
      throw ApiError.badRequest('Invalid temple ID');
    }

    if (!title || !title.trim()) {
      throw ApiError.badRequest('Recommendation title is required');
    }

    if (!observedFeedback || !observedFeedback.trim()) {
      throw ApiError.badRequest('Observed feedback evidence is required');
    }

    if (!suggestedAction || !suggestedAction.trim()) {
      throw ApiError.badRequest('Suggested action is required');
    }

    const temple = await Temple.findById(templeId);
    if (!temple) {
      throw ApiError.notFound('Temple not found');
    }

    const recommendation = await TempleRecommendation.create({
      templeId,
      title: title.trim(),
      category: category ? category.trim() : 'General Operations',
      observedFeedback: observedFeedback.trim(),
      suggestedAction: suggestedAction.trim(),
      status: RECOMMENDATION_STATUS.OPEN,
      createdAdminId: req.user?.userId || (req.user as any)?._id || req.user?.id,
    });

    await logAuditActivity({
      actorId: req.user?.userId || (req.user as any)?._id || req.user?.id,
      actorRole: req.user?.role || 'ADMIN',
      action: AUDIT_ACTIONS.RECOMMENDATION_CREATED,
      entityType: AUDIT_ENTITY_TYPES.RECOMMENDATION,
      entityId: recommendation._id,
      description: `Created administrative recommendation for "${temple.name}": "${recommendation.title}"`,
      metadata: { templeId, title: recommendation.title },
    });

    return ApiResponse.created(
      res,
      recommendation,
      'Recommendation created successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/recommendations
 */
export const getAdminTempleRecommendations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { templeId, status } = req.query as Record<string, any>;

    const query: Record<string, any> = {};
    if (templeId && mongoose.Types.ObjectId.isValid(templeId as any)) {
      query.templeId = templeId;
    }
    if (status && String(status).toUpperCase() !== 'ALL') {
      query.status = String(status).toUpperCase();
    }

    const recommendations = await TempleRecommendation.find(query)
      .populate('templeId', 'name city state slug')
      .populate('createdAdminId', 'name email')
      .populate('statusUpdatedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponse.success(
      res,
      recommendations,
      'Recommendations retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 11. ANALYTICS & INSIGHTS
 * Real MongoDB aggregations with dynamic range filtering (7d, 30d, 90d, 1y)
 * GET /api/admin/analytics?range=7d|30d|90d|1y
 */
export const getAdminAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const range = (String(req.query.range || '30d')).toLowerCase();
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;
    else if (range === '1y' || range === 'year') days = 365;

    const calendarMonth = (req.query.calendarMonth || req.query.month) as string | undefined;
    let targetYear = 2026;
    let targetMonthIndex = 8; // 8 = September (0-indexed)
    if (calendarMonth && /^\d{4}-\d{2}$/.test(calendarMonth)) {
      const [y, m] = calendarMonth.split('-').map(Number);
      targetYear = y;
      targetMonthIndex = m - 1;
    } else {
      const now = new Date();
      targetYear = now.getFullYear();
      targetMonthIndex = now.getMonth();
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    const prevEndDate = new Date(startDate);

    // Parallel MongoDB queries & aggregations
    const [
      templeCount,
      activeTemples,
      pendingRegistrations,
      devoteeCount,
      authorityCount,
      allTimeBookingCounts,
      rangeBookingCounts,
      prevBookingCount,
      rangePaymentStats,
      allTimePaymentStats,
      prevRevenueStats,
      popularTemples,
      popularServices,
      categoriesWithTemples,
      categoryBookingsAgg,
      revenueByTemple,
      dailyBookingsAgg,
      dailyPaymentsAgg,
      dailyDevoteesAgg,
      prevDevoteesCount,
      allDailyBookingsAgg,
    ] = await Promise.all([
      // 1. Temples
      Temple.countDocuments(),
      Temple.countDocuments({ status: TEMPLE_STATUS.ACTIVE }),
      TempleRegistration.countDocuments({ status: REGISTRATION_STATUS.PENDING }),
      // 2. Users
      User.countDocuments({ role: USER_ROLES.DEVOTEE }),
      User.countDocuments({ role: USER_ROLES.TEMPLE_AUTHORITY }),
      // 3. All-time Booking counts
      Booking.aggregate([
        { $group: { _id: '$bookingStatus', count: { $sum: 1 } } },
      ]),
      // 4. Range Booking counts
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$bookingStatus', count: { $sum: 1 } } },
      ]),
      // 5. Prev Booking count (for comparison)
      Booking.countDocuments({ createdAt: { $gte: prevStartDate, $lt: prevEndDate } }),
      // 6. Range Payments
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      // 7. All-time Payments
      Payment.aggregate([
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      // 8. Prev Revenue (for comparison)
      Payment.aggregate([
        { $match: { status: 'PAID', createdAt: { $gte: prevStartDate, $lt: prevEndDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // 9. Top temples by bookings in range
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate }, bookingStatus: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$templeId', bookingsCount: { $sum: 1 } } },
        { $sort: { bookingsCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'temples',
            localField: '_id',
            foreignField: '_id',
            as: 'temple',
          },
        },
        { $unwind: { path: '$temple', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            templeId: '$_id',
            bookingsCount: 1,
            templeName: { $ifNull: ['$temple.name', 'Other Shrines'] },
            city: '$temple.city',
          },
        },
      ]),
      // 10. Top services by bookings in range
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate }, bookingStatus: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$serviceId', bookingsCount: { $sum: 1 } } },
        { $sort: { bookingsCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'services',
            localField: '_id',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            serviceId: '$_id',
            bookingsCount: 1,
            serviceName: { $ifNull: ['$service.name', 'Special Pooja Seva'] },
            type: '$service.type',
          },
        },
      ]),
      // 11. Categories with temples
      TempleCategory.aggregate([
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
            ],
            as: 'templeMatches',
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            slug: 1,
            templeCount: { $size: '$templeMatches' },
          },
        },
        { $sort: { templeCount: -1 } },
      ]),
      // 12. Bookings distributed by temple category (1-to-1 mapping guaranteeing reconciliation with total reservations)
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $lookup: {
            from: 'temples',
            localField: 'templeId',
            foreignField: '_id',
            as: 'temple',
          },
        },
        { $unwind: { path: '$temple', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            primaryCatId: {
              $arrayElemAt: [{ $ifNull: ['$temple.categories', []] }, 0],
            },
          },
        },
        {
          $lookup: {
            from: 'templecategories',
            localField: 'primaryCatId',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$category.name', 'Other Shrines'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      // 13. Revenue contribution by temple (settled payments)
      Payment.aggregate([
        { $match: { status: 'PAID', createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$templeId',
            revenue: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        {
          $lookup: {
            from: 'temples',
            localField: '_id',
            foreignField: '_id',
            as: 'temple',
          },
        },
        { $unwind: { path: '$temple', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            templeId: '$_id',
            revenue: 1,
            transactionCount: 1,
            templeName: { $ifNull: ['$temple.name', 'Other Shrines'] },
          },
        },
      ]),
      // 14. Daily bookings trend
      Booking.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            bookings: { $sum: 1 },
          },
        },
      ]),
      // 15. Daily payments trend (PAID only)
      Payment.aggregate([
        { $match: { status: 'PAID', createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      // 16. Daily devotee signups
      User.aggregate([
        { $match: { role: USER_ROLES.DEVOTEE, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            devotees: { $sum: 1 },
          },
        },
      ]),
      // 17. Prev Devotees Count
      User.countDocuments({
        role: USER_ROLES.DEVOTEE,
        createdAt: { $gte: prevStartDate, $lt: prevEndDate },
      }),
      // 18. All daily bookings for monthly heatmap calendar
      Booking.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            bookings: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Parse booking counts by status for selected range
    const bookingSummary = {
      total: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      pending: 0,
    };
    rangeBookingCounts.forEach((bc) => {
      bookingSummary.total += bc.count;
      const statusKey = (bc._id || '').toLowerCase();
      if ((bookingSummary as Record<string, any>)[statusKey] !== undefined) {
        (bookingSummary as Record<string, any>)[statusKey] = bc.count;
      }
    });

    // Clean array for Booking Status Donut Chart
    const bookingStatus = [
      {
        label: 'Confirmed',
        status: 'CONFIRMED',
        count: bookingSummary.confirmed + bookingSummary.completed,
        color: '#059669', // Emerald
      },
      {
        label: 'Pending',
        status: 'PENDING',
        count: bookingSummary.pending,
        color: '#D97706', // Saffron/Amber
      },
      {
        label: 'Cancelled',
        status: 'CANCELLED',
        count: bookingSummary.cancelled,
        color: '#DC2626', // Rose/Red
      },
    ];

    // Parse settled payment revenue in range
    let rangeRevenue = 0;
    let rangeTransactions = 0;
    rangePaymentStats.forEach((ps) => {
      if (ps._id === 'PAID') {
        rangeRevenue = ps.totalAmount;
        rangeTransactions = ps.count;
      }
    });

    // Parse all-time settled payment revenue
    let allTimeRevenue = 0;
    let allTimeTransactions = 0;
    allTimePaymentStats.forEach((ps) => {
      if (ps._id === 'PAID') {
        allTimeRevenue = ps.totalAmount;
        allTimeTransactions = ps.count;
      }
    });

    // Calculate real comparison percentages only when previous period > 0
    const calculateChange = (current: number, previous: number) => {
      if (!previous || previous <= 0) return null;
      return Math.round(((current - previous) / previous) * 100);
    };

    const prevRevenueAmount = prevRevenueStats[0]?.total || 0;
    const bookingChange = calculateChange(bookingSummary.total, prevBookingCount);
    const revenueChange = calculateChange(rangeRevenue, prevRevenueAmount);
    const rangeDevoteesCount = dailyDevoteesAgg.reduce((acc, d) => acc + (d.devotees || 0), 0);
    const devoteeChange = calculateChange(rangeDevoteesCount, prevDevoteesCount);

    // Build Time Series Trends (continuous date axis)
    const bookingsMap = new Map();
    dailyBookingsAgg.forEach((item) => bookingsMap.set(item._id, item.bookings || 0));

    const paymentsMap = new Map();
    dailyPaymentsAgg.forEach((item) => paymentsMap.set(item._id, item.revenue || 0));

    const devoteesMap = new Map();
    dailyDevoteesAgg.forEach((item) => devoteesMap.set(item._id, item.devotees || 0));

    const bookingRevenueTrend = [];
    const devoteeRegistrationTrend = [];

    if (days <= 30) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        });
        bookingRevenueTrend.push({
          date: dateStr,
          label,
          bookings: bookingsMap.get(dateStr) || 0,
          revenue: paymentsMap.get(dateStr) || 0,
        });
        devoteeRegistrationTrend.push({
          date: dateStr,
          label,
          devotees: devoteesMap.get(dateStr) || 0,
        });
      }
    } else if (days <= 90) {
      // 90 days: step by 2 or 3 days for clean readable charts
      for (let i = days - 1; i >= 0; i -= 3) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        });
        bookingRevenueTrend.push({
          date: dateStr,
          label,
          bookings: bookingsMap.get(dateStr) || 0,
          revenue: paymentsMap.get(dateStr) || 0,
        });
        devoteeRegistrationTrend.push({
          date: dateStr,
          label,
          devotees: devoteesMap.get(dateStr) || 0,
        });
      }
    } else {
      // 1 year: 12 monthly slots
      const monthMapBookings = new Map();
      const monthMapRevenue = new Map();
      const monthMapDevotees = new Map();

      dailyBookingsAgg.forEach((item) => {
        const m = item._id.slice(0, 7);
        monthMapBookings.set(m, (monthMapBookings.get(m) || 0) + item.bookings);
      });
      dailyPaymentsAgg.forEach((item) => {
        const m = item._id.slice(0, 7);
        monthMapRevenue.set(m, (monthMapRevenue.get(m) || 0) + item.revenue);
      });
      dailyDevoteesAgg.forEach((item) => {
        const m = item._id.slice(0, 7);
        monthMapDevotees.set(m, (monthMapDevotees.get(m) || 0) + item.devotees);
      });

      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString('en-IN', { month: 'short' });

        bookingRevenueTrend.push({
          date: monthStr,
          label,
          bookings: monthMapBookings.get(monthStr) || 0,
          revenue: monthMapRevenue.get(monthStr) || 0,
        });
        devoteeRegistrationTrend.push({
          date: monthStr,
          label,
          devotees: monthMapDevotees.get(monthStr) || 0,
        });
      }
    }

    // Category Distribution: Dynamic from MongoDB
    let categoryDistribution = (categoryBookingsAgg || [])
      .filter((c) => c._id)
      .map((c) => ({
        label: c._id,
        value: c.count,
      }));

    if (categoryDistribution.length === 0) {
      categoryDistribution = (categoriesWithTemples || [])
        .filter((c) => c.name && c.templeCount > 0)
        .map((c) => ({
          label: c.name,
          value: c.templeCount,
        }));
    }

    // Revenue by Temple: compute shares & jewel-toned colors
    const totalSettledRev = revenueByTemple.reduce((acc, t) => acc + (t.revenue || 0), 0);
    const treemapPalette = ['#7C1D3A', '#D97706', '#6D28D9', '#2563EB', '#059669', '#DB2777', '#4B5563'];

    let formattedRevenueByTemple = [];
    if (revenueByTemple.length <= 6) {
      formattedRevenueByTemple = revenueByTemple.map((t, idx) => ({
        templeId: t.templeId,
        templeName: t.templeName,
        revenue: t.revenue,
        percentage: totalSettledRev > 0 ? Number(((t.revenue / totalSettledRev) * 100).toFixed(1)) : 0,
        transactionCount: t.transactionCount,
        color: treemapPalette[idx % treemapPalette.length],
      }));
    } else {
      const top5 = revenueByTemple.slice(0, 5);
      const remaining = revenueByTemple.slice(5);
      const remainingRev = remaining.reduce((acc, t) => acc + (t.revenue || 0), 0);
      const remainingTx = remaining.reduce((acc, t) => acc + (t.transactionCount || 0), 0);

      formattedRevenueByTemple = top5.map((t, idx) => ({
        templeId: t.templeId,
        templeName: t.templeName,
        revenue: t.revenue,
        percentage: totalSettledRev > 0 ? Number(((t.revenue / totalSettledRev) * 100).toFixed(1)) : 0,
        transactionCount: t.transactionCount,
        color: treemapPalette[idx % treemapPalette.length],
      }));

      if (remainingRev > 0) {
        formattedRevenueByTemple.push({
          templeId: 'others',
          templeName: 'Others',
          revenue: remainingRev,
          percentage: totalSettledRev > 0 ? Number(((remainingRev / totalSettledRev) * 100).toFixed(1)) : 0,
          transactionCount: remainingTx,
          color: '#4B5563',
        });
      }
    }

    // ----------------------------------------------------
    // 1. BOOKING FLOW ACROSS TEMPLE SERVICES (Sankey / Flow Data)
    // ----------------------------------------------------
    // Fetch all active temples to guarantee representation when temples <= 6
    const activeTemplesList = await Temple.find({ status: 'ACTIVE' })
      .select('name coverImage gallery')
      .lean();

    // Fetch all bookings in range with temple and service populated
    const flowBookings = await Booking.find({ createdAt: { $gte: startDate } })
      .populate('templeId', 'name coverImage gallery')
      .populate('serviceId', 'name type')
      .select('templeId serviceId bookingStatus createdAt')
      .lean();

    // Aggregates for Flow
    const templeCountMap = new Map();
    const serviceCatMap = new Map();
    const statusMap = {
      CONFIRMED: 0,
      PENDING: 0,
      CANCELLED: 0,
    };
    const templeToServiceMap = new Map(); // "templeId|category" -> count
    const serviceToStatusMap = new Map(); // "category|status" -> count

    // If total active temples <= 6, pre-populate all active temples
    if (activeTemplesList.length <= 6) {
      activeTemplesList.forEach((t) => {
        templeCountMap.set(t._id.toString(), {
          id: t._id.toString(),
          name: t.name,
          count: 0,
        });
      });
    }

    flowBookings.forEach((b) => {
      const templeObj = b.templeId as any;
      const bTempleId = templeObj?._id?.toString();
      let tId = bTempleId;
      let tName = templeObj?.name;

      if (!tId || (!templeCountMap.has(tId) && activeTemplesList.length <= 6)) {
        tId = 'other_shrines';
        tName = 'Other Shrines';
        if (!templeCountMap.has(tId)) {
          templeCountMap.set(tId, { id: tId, name: tName, count: 0 });
        }
      } else if (!templeCountMap.has(tId)) {
        templeCountMap.set(tId, { id: tId, name: tName || 'Other Shrines', count: 0 });
      }
      templeCountMap.get(tId).count += 1;

      // Determine clean service category name
      let cat = 'Other Sevas';
      const serviceObj = b.serviceId as any;
      const rawType = (serviceObj?.type || '').toUpperCase();
      const rawName = (serviceObj?.name || '').trim();
      if (rawType.includes('DARSHAN') || rawName.toUpperCase().includes('DARSHAN')) cat = 'Darshan';
      else if (rawType.includes('POOJA') || rawName.toUpperCase().includes('POOJA')) cat = 'Pooja';
      else if (rawType.includes('SEVA') || rawName.toUpperCase().includes('SEVA')) cat = 'Seva';
      else if (rawType.includes('SPECIAL') || rawName.toUpperCase().includes('SPECIAL')) cat = 'Special Entry';
      else if (rawName) {
        cat = rawName.length > 18 ? rawName.slice(0, 16) + '…' : rawName;
      }

      if (!serviceCatMap.has(cat)) {
        serviceCatMap.set(cat, { name: cat, count: 0 });
      }
      serviceCatMap.get(cat).count += 1;

      // Normalize status
      let sKey = 'PENDING';
      const bStatus = (b.bookingStatus || '').toUpperCase();
      if (['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(bStatus)) {
        sKey = 'CONFIRMED';
      } else if (bStatus === 'CANCELLED') {
        sKey = 'CANCELLED';
      }
      (statusMap as Record<string, number>)[sKey] = ((statusMap as Record<string, number>)[sKey] || 0) + 1;

      // Link counts
      const t2sKey = `${tId}|${cat}`;
      templeToServiceMap.set(t2sKey, (templeToServiceMap.get(t2sKey) || 0) + 1);

      const s2stKey = `${cat}|${sKey}`;
      serviceToStatusMap.set(s2stKey, (serviceToStatusMap.get(s2stKey) || 0) + 1);
    });

    const flowTemples = Array.from(templeCountMap.values())
      .filter((t) => t.count > 0 || activeTemplesList.length <= 6)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((t, idx) => ({
        ...t,
        color: ['#D97706', '#991B1B', '#7C3AED', '#2563EB', '#059669', '#DB2777'][idx % 6],
      }));

    const flowCategories = Array.from(serviceCatMap.values())
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c, idx) => ({
        ...c,
        color: ['#F59E0B', '#E11D48', '#8B5CF6', '#3B82F6', '#6B7280'][idx % 5],
      }));

    const flowStatuses = [
      { key: 'CONFIRMED', label: 'Confirmed', count: statusMap.CONFIRMED, color: '#059669' },
      { key: 'PENDING', label: 'Pending', count: statusMap.PENDING, color: '#D97706' },
      { key: 'CANCELLED', label: 'Cancelled', count: statusMap.CANCELLED, color: '#DC2626' },
    ];

    const templeToServiceFlows: any[] = [];
    templeToServiceMap.forEach((count, key) => {
      if (count > 0) {
        const [templeId, category] = key.split('|');
        templeToServiceFlows.push({ templeId, category, count });
      }
    });

    const serviceToStatusFlows: any[] = [];
    serviceToStatusMap.forEach((count, key) => {
      if (count > 0) {
        const [category, status] = key.split('|');
        serviceToStatusFlows.push({ category, status, count });
      }
    });

    const bookingFlow = {
      temples: flowTemples,
      categories: flowCategories,
      statuses: flowStatuses,
      templeToServiceFlows,
      serviceToStatusFlows,
      totalBookings: flowBookings.length,
    };

    // ----------------------------------------------------
    // 2. DAILY BOOKING CALENDAR (Heatmap Grid Data)
    // Dynamic month calculation with real weekday alignment
    // ----------------------------------------------------
    const allBookingsMap = new Map();
    (allDailyBookingsAgg || []).forEach((item) => {
      if (item._id) allBookingsMap.set(item._id, item.bookings || 0);
    });

    const daysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    const calendarDays = [];
    let peakDay = { date: '', count: 0, label: 'N/A' };
    let lowestDay = { date: '', count: Infinity, label: 'N/A' };
    let totalCalBookings = 0;

    const monthNameShort = new Date(targetYear, targetMonthIndex, 1).toLocaleDateString('en-IN', {
      month: 'short',
    });

    for (let dayNum = 1; dayNum <= daysInTargetMonth; dayNum++) {
      const d = new Date(targetYear, targetMonthIndex, dayNum);
      const dateStr = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const count = allBookingsMap.get(dateStr) || 0;
      totalCalBookings += count;

      const dateLabel = `${dayNum} ${monthNameShort} ${targetYear}`;

      if (count > peakDay.count || (!peakDay.date && count >= 0)) {
        peakDay = { date: dateStr, count, label: dateLabel };
      }
      if (count < lowestDay.count) {
        lowestDay = { date: dateStr, count, label: dateLabel };
      }

      calendarDays.push({
        date: dateStr,
        dayOfMonth: dayNum,
        dayOfWeek: d.getDay(), // 0 = Sun, 1 = Mon ...
        month: monthNameShort,
        year: targetYear,
        count,
      });
    }

    if (lowestDay.count === Infinity) {
      lowestDay = { date: '', count: 0, label: 'N/A' };
    }
    const avgPerDay = daysInTargetMonth > 0 ? Number((totalCalBookings / daysInTargetMonth).toFixed(1)) : 0;

    const activityCalendar = {
      days: calendarDays,
      year: targetYear,
      month: targetMonthIndex,
      daysInMonth: daysInTargetMonth,
      monthLabel: `${monthNameShort} ${targetYear}`,
      currentMonthLabel: `${monthNameShort} ${targetYear}`,
      startDayOfWeek: (new Date(targetYear, targetMonthIndex, 1).getDay() + 6) % 7, // 0 = Mon
      stats: {
        peakDay,
        lowestDay,
        avgPerDay,
        totalBookings: totalCalBookings,
      },
      bookingCountsByDate: Object.fromEntries(allBookingsMap),
    };

    // ----------------------------------------------------
    // 3. TEMPLE POPULARITY TREND (Bump / Rank Line Chart)
    // ----------------------------------------------------
    // Independent interval-by-interval ranking calculation
    const intervalCount = 7;
    const intervalStepMs = (Date.now() - startDate.getTime()) / intervalCount;
    const intervals = [];

    for (let i = 0; i < intervalCount; i++) {
      const iStart = new Date(startDate.getTime() + i * intervalStepMs);
      const iEnd = new Date(startDate.getTime() + (i + 1) * intervalStepMs);
      intervals.push({
        start: iStart,
        end: iEnd,
        date: iEnd.toISOString().slice(0, 10),
        label: iEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      });
    }

    // Top temples with confirmed bookings to track (avoid tracking zero-booking shrines as 'popular')
    const templesWithBookings = flowTemples.filter(
      (t) => t.count > 0 && t.id !== 'other_shrines'
    );
    const top5Temples =
      templesWithBookings.length > 0
        ? templesWithBookings.slice(0, 5)
        : flowTemples.filter((t) => t.id !== 'other_shrines').slice(0, 5);

    const templeRankSeries = top5Temples.map((temple) => ({
      templeId: temple.id,
      templeName: temple.name,
      color: temple.color,
      ranks: [] as any[],
    }));

    // For each interval, compute count of confirmed bookings strictly within [interval.start, interval.end)
    intervals.forEach((interval) => {
      const countsThisInterval = top5Temples.map((temple) => {
        const count = flowBookings.filter((b) => {
          const bTime = new Date(b.createdAt as any).getTime();
          const matchesTemple =
            b.templeId?._id?.toString() === temple.id ||
            (temple.id === 'other_shrines' && !b.templeId?._id);
          const isConfirmed = ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(
            (b.bookingStatus || '').toUpperCase()
          );
          return (
            matchesTemple &&
            isConfirmed &&
            bTime >= interval.start.getTime() &&
            bTime < interval.end.getTime()
          );
        }).length;

        return {
          templeId: temple.id,
          count,
        };
      });

      // Sort descending by count for this interval
      countsThisInterval.sort((a, b) => b.count - a.count);

      countsThisInterval.forEach((item, rIdx) => {
        const seriesItem = templeRankSeries.find((t) => t.templeId === item.templeId);
        if (seriesItem) {
          seriesItem.ranks.push({
            date: interval.date,
            label: interval.label,
            count: item.count,
            rank: rIdx + 1,
          });
        }
      });
    });

    const popularityTrend = {
      checkpoints: intervals.map((c) => ({ date: c.date, label: c.label })),
      series: templeRankSeries,
    };

    // Clean service names for Top Temple Services (title case, no raw UPPERCASE_SNAKE_CASE)
    const cleanServiceName = (name: string) => {
      if (!name) return 'Special Seva';
      if (/^[A-Z0-9_]+$/.test(name)) {
        return name
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
      return name;
    };

    const formattedPopularServices = popularServices.map((s) => ({
      ...s,
      serviceName: cleanServiceName(s.serviceName),
    }));

    return ApiResponse.success(
      res,
      {
        range,
        kpis: {
          totalTemples: templeCount,
          activeTemples,
          pendingRegistrations,
          totalDevotees: devoteeCount,
          totalAuthorities: authorityCount,
          totalBookings: bookingSummary.total,
          allTimeBookings: allTimeBookingCounts.reduce((acc, c) => acc + c.count, 0),
          confirmedBookings: bookingSummary.confirmed,
          cancelledBookings: bookingSummary.cancelled,
          settledRevenue: rangeRevenue,
          allTimeRevenue,
          successfulTransactions: rangeTransactions,
          allTimeTransactions,
          // Real change percentages (null if cannot be reliably computed)
          bookingChange,
          revenueChange,
          devoteeChange,
        },
        bookingSummary,
        bookingStatus,
        bookingFlow,
        activityCalendar,
        popularityTrend,
        trends: {
          bookingRevenue: bookingRevenueTrend,
          devoteeRegistrations: devoteeRegistrationTrend,
        },
        popularTemples,
        popularServices: formattedPopularServices,
        categoryStats: categoriesWithTemples,
        categoryDistribution,
        revenueByTemple: formattedRevenueByTemple,
      },
      'Admin analytics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 12. AUDIT & ACTIVITY TIMELINE
 * GET /api/admin/audit-logs
 */
export const getAdminAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const skip = (page - 1) * limit;
    const { action, entityType, search } = req.query as Record<string, any>;

    const query: Record<string, any> = {};

    if (action && String(action).toUpperCase() !== 'ALL') {
      query.action = String(action).toUpperCase();
    }

    if (entityType && String(entityType).toUpperCase() !== 'ALL') {
      query.entityType = String(entityType).toUpperCase();
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query.description = searchRegex;
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .populate('actorId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return ApiResponse.success(
      res,
      {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Audit logs retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 13. WEBSITE REACH TIME SERIES
 * GET /api/admin/reach?range=7d|30d|90d
 * Real data aggregated from SiteReachMetric. Empty states preserved (no fake numbers).
 */
export const getWebsiteReach = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const range = (String(req.query.range || '7d')).toLowerCase();
    let days = 7;
    if (range === '30d') days = 30;
    else if (range === '90d') days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startDateStr = startDate.toISOString().slice(0, 10);

    const metrics = await SiteReachMetric.find({ date: { $gte: startDateStr } }).lean();
    const metricMap = new Map();
    metrics.forEach((m) => {
      metricMap.set(m.date, {
        visitors: m.visitorCount || m.uniqueVisitors?.length || 0,
        pageViews: m.pageViews || 0,
      });
    });

    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const item = metricMap.get(dateStr) || { visitors: 0, pageViews: 0 };
      const label = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: days > 30 ? 'numeric' : 'short',
      });
      result.push({
        date: dateStr,
        label,
        visitors: item.visitors,
        pageViews: item.pageViews,
      });
    }

    return ApiResponse.success(res, result, 'Website reach metrics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * 14. TEMPLE-WISE BOOKINGS RADIAL ANALYTICS
 * GET /api/admin/analytics/temple-bookings?range=7d|30d|90d|all
 * Aggregates actual ticket quantities and bookings per active temple.
 */
export const getTempleBookingsAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const range = (String(req.query.range || '30d')).toLowerCase();
    const matchStage: Record<string, any> = {
      bookingStatus: { $nin: ['CANCELLED', 'REJECTED'] },
    };

    if (range !== 'all') {
      let days = 30;
      if (range === '7d') days = 7;
      else if (range === '90d') days = 90;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      startDate.setHours(0, 0, 0, 0);

      matchStage.$or = [
        { bookingDate: { $gte: startDate } },
        { createdAt: { $gte: startDate } },
      ];
    }

    // Aggregate bookings by templeId
    const bookingAggregates = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$templeId',
          ticketCount: {
            $sum: {
              $cond: [
                { $gt: ['$quantity', 0] },
                '$quantity',
                {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$devotees', []] } }, 0] },
                    { $size: '$devotees' },
                    1,
                  ],
                },
              ],
            },
          },
          bookingCount: { $sum: 1 },
        },
      },
    ]);

    const bookingMap = new Map();
    bookingAggregates.forEach((item) => {
      if (item._id) {
        bookingMap.set(item._id.toString(), {
          ticketCount: item.ticketCount || 0,
          bookingCount: item.bookingCount || 0,
        });
      }
    });

    // Fetch active temples from database
    const temples = await Temple.find({
      status: TEMPLE_STATUS.ACTIVE,
    })
      .select('name slug city state coverImage gallery')
      .lean();

    // Map each temple and choose best available image according to priority
    let totalTickets = 0;
    let totalBookings = 0;

    const templeList = temples.map((temple) => {
      const stats = bookingMap.get(temple._id.toString()) || { ticketCount: 0, bookingCount: 0 };
      totalTickets += stats.ticketCount;
      totalBookings += stats.bookingCount;

      // Image priority: 1. thumbnail, 2. banner, 3. cover image, 4. first gallery image, 5. null fallback
      let image = null;
      if (Array.isArray(temple.gallery) && temple.gallery.length > 0) {
        const thumb = temple.gallery.find((g) => g.isThumbnail && g.url);
        const banner = temple.gallery.find((g) => g.isBanner && g.url);
        const first = temple.gallery.find((g) => g.url);
        image = thumb?.url || banner?.url || temple.coverImage?.url || first?.url || null;
      } else if (temple.coverImage?.url) {
        image = temple.coverImage.url;
      }

      return {
        templeId: temple._id.toString(),
        templeName: temple.name,
        slug: temple.slug,
        city: temple.city,
        state: temple.state,
        image,
        ticketCount: stats.ticketCount,
        bookingCount: stats.bookingCount,
      };
    });

    // Also include any booked temples that might not have ACTIVE status flag
    for (const [templeIdStr, stats] of bookingMap.entries()) {
      const alreadyIncluded = templeList.some((t) => t.templeId === templeIdStr);
      if (!alreadyIncluded) {
        try {
          const extraTemple = await Temple.findById(templeIdStr)
            .select('name slug city state coverImage gallery')
            .lean();
          if (extraTemple) {
            totalTickets += stats.ticketCount;
            totalBookings += stats.bookingCount;

            let image = null;
            if (Array.isArray(extraTemple.gallery) && extraTemple.gallery.length > 0) {
              const thumb = extraTemple.gallery.find((g) => g.isThumbnail && g.url);
              const banner = extraTemple.gallery.find((g) => g.isBanner && g.url);
              const first = extraTemple.gallery.find((g) => g.url);
              image = thumb?.url || banner?.url || extraTemple.coverImage?.url || first?.url || null;
            } else if (extraTemple.coverImage?.url) {
              image = extraTemple.coverImage.url;
            }

            templeList.push({
              templeId: extraTemple._id.toString(),
              templeName: extraTemple.name,
              slug: extraTemple.slug,
              city: extraTemple.city,
              state: extraTemple.state,
              image,
              ticketCount: stats.ticketCount,
              bookingCount: stats.bookingCount,
            });
          }
        } catch {
          // ignore invalid objectId
        }
      }
    }

    // Calculate percentage and rank (1-indexed)
    const sortedTemples = templeList
      .sort((a, b) => b.ticketCount - a.ticketCount || b.bookingCount - a.bookingCount || a.templeName.localeCompare(b.templeName))
      .map((temple, idx) => ({
        ...temple,
        percentage: totalTickets > 0 ? Number(((temple.ticketCount / totalTickets) * 100).toFixed(1)) : 0,
        rank: idx + 1,
      }));

    return ApiResponse.success(
      res,
      {
        range,
        totalTickets,
        totalBookings,
        temples: sortedTemples,
      },
      'Temple-wise booking analytics retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Diagnostic SMTP test endpoint (Admin only).
 * Dispatches a lightweight test email using the centralized sendEmail service.
 * Does NOT create a User or Temple.
 * Route: POST /api/admin/email/test
 */
export const testEmailDelivery = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { to } = req.body || {};
    if (!to) {
      throw ApiError.badRequest('Recipient email ("to") is required.');
    }

    const testHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #FAF8F3; padding: 24px; margin: 0;">
  <div style="max-width: 500px; margin: 20px auto; background: white; padding: 28px; border-radius: 12px; border: 1px solid #EAE4D9; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <h2 style="color: #7A2E2E; margin-top: 0; font-family: serif;">DevaSetu SMTP Diagnostic Test</h2>
    <p style="color: #2D241E; font-size: 14px; line-height: 1.6;">
      This is an automated diagnostic test email dispatched from your DevaSetu application server.
    </p>
    <div style="background-color: #FEF3C7; border-left: 4px solid #B7791F; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
      <strong style="color: #92400E; font-size: 13px;">Status: SMTP Operational</strong>
      <p style="color: #92400E; font-size: 12px; margin: 4px 0 0 0;">
        If you are reading this email in your inbox, your Nodemailer transporter and SMTP credentials are working correctly.
      </p>
    </div>
    <hr style="border: none; border-top: 1px solid #EAE4D9; margin: 20px 0;" />
    <p style="font-size: 11px; color: #8C7E74; margin: 0;">
      Timestamp: ${new Date().toISOString()} | Server Environment: ${process.env.NODE_ENV || 'development'}
    </p>
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to,
      subject: 'DevaSetu SMTP Diagnostic Test',
      text: `DevaSetu SMTP Diagnostic Test\n\nThis is an automated test email sent from DevaSetu. Transporter is operational.\nTimestamp: ${new Date().toISOString()}`,
      html: testHtml,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        status: result.status,
        code: result.code || null,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      status: 'SENT',
      messageId: result.messageId,
      response: result.response,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getDashboardStats,
  getTempleRegistrations,
  getTempleRegistrationById,
  updateRegistrationStatus,
  approveRegistration,
  createAuthorityForRegistration,
  resendAuthorityCredentials,
  rejectRegistration,
  getTemples,
  getTempleById,
  updateTempleStatus,
  updateTempleCategories,
  getAuthorities,
  getUsers,
  updateUserStatus,
  getAdminDevotees,
  updateDevoteeStatus,
  getAdminBookings,
  getAdminPayments,
  getAdminReviews,
  getAdminReviewMetrics,
  updateAdminReviewStatus,
  getAdminTempleReviewInsights,
  createAdminTempleRecommendation,
  getAdminTempleRecommendations,
  getAdminAnalytics,
  getAdminAuditLogs,
  getWebsiteReach,
  getTempleBookingsAnalytics,
  testEmailDelivery,
};
