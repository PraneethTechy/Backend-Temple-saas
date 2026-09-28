import type { Request, Response, NextFunction } from 'express';
import { User, USER_ROLES } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../services/tokenService.js';
import { ENV } from '../config/env.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';

interface RegisterBody {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

interface CreateAdminBody {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Public Devotee Registration
 * Strictly creates role = DEVOTEE. Any attempted role injection is ignored.
 */
export const register = async (
  req: Request<Record<string, never>, unknown, RegisterBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return next(ApiError.badRequest('Name, email, and password are required'));
    }

    if (password.length < 6) {
      return next(ApiError.badRequest('Password must be at least 6 characters long'));
    }

    // Check duplicate email
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(ApiError.badRequest('An account with this email address already exists'));
    }

    // Strictly enforce DEVOTEE role; ignore any role or templeId in request body
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : '',
      password,
      role: USER_ROLES.DEVOTEE,
      templeId: null,
      isEmailVerified: false,
    });

    await newUser.save();

    // Generate JWT and set HTTP-only cookie
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json(
      ApiResponse.success(
        {
          user: newUser.toJSON(),
          token,
        },
        'Devotee account created successfully',
        201
      )
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * User Login (Devotee, Admin, or Temple Authority)
 */
export const login = async (
  req: Request<Record<string, never>, unknown, LoginBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(ApiError.badRequest('Email and password are required'));
    }

    // Select password hash explicitly for verification
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      console.log(`[AUTH LOGIN FAILED]: User not found for email: "${normalizedEmail}"`);
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    if (!user.isActive) {
      console.log(`[AUTH LOGIN FAILED]: User deactivated: "${normalizedEmail}"`);
      return next(ApiError.unauthorized('Your account has been deactivated. Please contact support.'));
    }

    // Verify password hash
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log(`[AUTH LOGIN FAILED]: Password mismatch for email: "${normalizedEmail}"`);
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    console.log(`[AUTH LOGIN SUCCESS]: email: "${normalizedEmail}", role: "${user.role}"`);

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT and set HTTP-only cookie
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json(
      ApiResponse.success(
        {
          user: user.toJSON(),
          token,
        },
        'Login successful'
      )
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Get Current Authenticated User Profile
 */
export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return next(ApiError.notFound('User profile not found'));
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          user: user.toJSON(),
        },
        'Profile retrieved successfully'
      )
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * User Logout
 */
export const logout = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    clearAuthCookie(res);
    return res.status(200).json(ApiResponse.success(null, 'Logged out successfully'));
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Admin Account Creation (Protected Bootstrap API)
 * Requires x-admin-bootstrap-secret header matching process.env.ADMIN_BOOTSTRAP_SECRET
 */
export const createAdmin = async (
  req: Request<Record<string, never>, unknown, CreateAdminBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const rawHeader =
      req.headers['x-admin-bootstrap-secret'] ||
      req.headers['x_admin_bootstrap_secret'] ||
      req.headers['admin-bootstrap-secret'];

    let cleanProvided = typeof rawHeader === 'string' ? rawHeader.trim() : '';
    // Strip accidental "Bearer " prefix
    cleanProvided = cleanProvided.replace(/^bearer\s+/i, '').trim();
    // Strip accidental surrounding quotes ("..." or '...')
    cleanProvided = cleanProvided.replace(/^["']|["']$/g, '').trim();
    // Strip accidental surrounding brackets ([...])
    cleanProvided = cleanProvided.replace(/^\[|\]$/g, '').trim();

    let cleanExpected = (process.env.ADMIN_BOOTSTRAP_SECRET || ENV.ADMIN_BOOTSTRAP_SECRET || '').trim();
    cleanExpected = cleanExpected.replace(/^["']|["']$/g, '').replace(/^\[|\]$/g, '').trim();

    // Safe diagnostics (does NOT log secret values)
    if (!cleanProvided || !cleanExpected || cleanProvided !== cleanExpected) {
      console.log('\n[createAdmin Auth Diagnostic]:');
      console.log('  Header present:', Boolean(rawHeader));
      console.log('  Provided length:', cleanProvided.length);
      console.log('  Expected length:', cleanExpected.length);
      console.log('  Lengths match:', cleanProvided.length === cleanExpected.length);
      console.log('  Received header names:', Object.keys(req.headers).filter(k => !k.startsWith('sec-') && k !== 'user-agent'));
      return next(ApiError.forbidden('Unauthorized: Invalid or missing administrative bootstrap secret'));
    }

    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return next(ApiError.badRequest('Name, email, and password are required'));
    }

    if (password.length < 6) {
      return next(ApiError.badRequest('Password must be at least 6 characters long'));
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(ApiError.badRequest('A user with this email address already exists'));
    }

    const adminUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone ? phone.trim() : '',
      password,
      role: USER_ROLES.ADMIN,
      templeId: null,
      isEmailVerified: true,
    });

    await adminUser.save();

    return res.status(201).json(
      ApiResponse.success(
        {
          user: adminUser.toJSON(),
        },
        'Admin account created successfully',
        201
      )
    );
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Change Password Endpoint
 * Authenticated user changes password; resets mustChangePassword flag.
 */
export const changePassword = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    const { currentPassword, newPassword } = req.body as ChangePasswordBody;

    if (!currentPassword || !newPassword) {
      return next(ApiError.badRequest('Current password and new password are required'));
    }

    if (newPassword.length < 6) {
      return next(ApiError.badRequest('New password must be at least 6 characters long'));
    }

    if (currentPassword === newPassword) {
      return next(ApiError.badRequest('New password must be different from current password'));
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(ApiError.badRequest('Current password is incorrect'));
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    return res.status(200).json(ApiResponse.success({ mustChangePassword: false }, 'Password updated successfully'));
  } catch (error: unknown) {
    next(error);
  }
};

export default {
  register,
  login,
  getMe,
  logout,
  createAdmin,
  changePassword,
};
