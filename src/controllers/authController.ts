import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
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

interface GoogleLoginBody {
  credential?: string;
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
 * Public Devotee Google Sign-In
 * POST /api/auth/google
 * Body: { credential: string }
 *
 * Verifies Google ID token server-side using Google Identity Services.
 * DEVOTEE ONLY:
 * - Creates role = DEVOTEE if new user.
 * - Links googleId if existing devotee.
 * - Rejects with 403 if existing user is ADMIN or TEMPLE_AUTHORITY.
 * - Never grants ADMIN or TEMPLE_AUTHORITY role via Google Sign-In.
 */
export const googleLogin = async (
  req: Request<Record<string, never>, unknown, GoogleLoginBody>,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { credential } = req.body;

    if (!credential || typeof credential !== 'string') {
      return next(ApiError.badRequest('Google authentication credential is required'));
    }

    if (!ENV.GOOGLE_CLIENT_ID) {
      console.error('[AUTH GOOGLE]: GOOGLE_CLIENT_ID is not configured in server environment');
      return next(ApiError.internal('Google authentication is not properly configured on server'));
    }

    // Verify Google ID token server-side
    const client = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: ENV.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError: any) {
      console.warn('[AUTH GOOGLE]: Token verification failed:', verifyError?.message);
      return next(ApiError.unauthorized('Google authentication failed: Invalid or expired token'));
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return next(ApiError.unauthorized('Google authentication failed: Email claim missing from token'));
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase().trim();
    const name = payload.name?.trim() || email.split('@')[0] || 'Devotee';
    const avatar = payload.picture || null;
    const isEmailVerified = payload.email_verified ?? true;

    // Check Case 1: Existing Google-linked user
    let user = await User.findOne({ googleId });

    if (user) {
      // Role security: Devotee-only endpoint
      if (user.role !== USER_ROLES.DEVOTEE) {
        return next(
          ApiError.forbidden(
            'This account has administrative privileges. Please sign in via the designated administrative console.'
          )
        );
      }

      if (!user.isActive) {
        return next(ApiError.unauthorized('Your account has been deactivated. Please contact support.'));
      }

      user.lastLoginAt = new Date();
      if (!user.avatar && avatar) user.avatar = avatar;
      if (!user.isEmailVerified && isEmailVerified) user.isEmailVerified = true;
      await user.save();
    } else {
      // Check Case 3 & 4: User with this email already exists
      const existingUserByEmail = await User.findOne({ email });

      if (existingUserByEmail) {
        // Case 4: Existing ADMIN or TEMPLE_AUTHORITY -> conflict / forbidden
        if (existingUserByEmail.role !== USER_ROLES.DEVOTEE) {
          return next(
            ApiError.forbidden(
              'An administrative account already exists with this email address. Please sign in via the designated portal.'
            )
          );
        }

        if (!existingUserByEmail.isActive) {
          return next(ApiError.unauthorized('Your account has been deactivated. Please contact support.'));
        }

        // Case 3: Existing DEVOTEE -> safely link Google identity
        existingUserByEmail.googleId = googleId;
        existingUserByEmail.lastLoginAt = new Date();
        if (!existingUserByEmail.avatar && avatar) existingUserByEmail.avatar = avatar;
        if (isEmailVerified) existingUserByEmail.isEmailVerified = true;
        await existingUserByEmail.save();

        user = existingUserByEmail;
      } else {
        // Case 2: New user -> strictly role = DEVOTEE
        user = new User({
          name,
          email,
          role: USER_ROLES.DEVOTEE,
          googleId,
          avatar,
          isActive: true,
          isEmailVerified,
          mustChangePassword: false,
          lastLoginAt: new Date(),
        });

        await user.save();
      }
    }

    // Generate JWT and set HTTP-only cookie using existing mechanisms
    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json(
      ApiResponse.success(
        {
          user: user.toJSON(),
          token,
        },
        'Google sign-in successful'
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
