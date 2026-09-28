import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { ENV } from '../config/env.js';
import { User, USER_ROLES, type UserRole } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';
import { COOKIE_NAME } from '../services/tokenService.js';

export interface AuthenticatedUserPayload {
  userId: Types.ObjectId;
  id: Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  templeId?: Types.ObjectId | null;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
      templeId?: Types.ObjectId | null;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
  templeId?: Types.ObjectId | null;
}

export interface DecodedToken extends jwt.JwtPayload {
  userId: string;
  role?: string;
  templeId?: string | null;
  mustChangePassword?: boolean;
}

export type TempleIdExtractor = (req: Request) => string | Types.ObjectId | undefined | null;
export type UserIdExtractor = (req: Request) => string | Types.ObjectId | undefined | null;

/**
 * Authentication Middleware
 * Validates JWT from HTTP-only cookie or Authorization Bearer header.
 * Attaches verified user metadata to req.user (no password hash).
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | null = null;

    // 1. Try reading token from HTTP-only cookie
    if (req.cookies && (req.cookies[COOKIE_NAME] || req.cookies.token)) {
      token = (req.cookies[COOKIE_NAME] || req.cookies.token) as string;
    }

    // 2. Fallback to Authorization Bearer header (for Postman / API clients)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('Authentication required. Please sign in.'));
    }

    // 3. Verify JWT token signature and expiration
    let decoded: DecodedToken;
    try {
      const verified = jwt.verify(token, ENV.JWT_SECRET as string);
      decoded = verified as DecodedToken;
    } catch {
      return next(ApiError.unauthorized('Invalid or expired authentication session. Please sign in again.'));
    }

    // 4. Verify user exists and is active in database
    const user = await User.findById(decoded.userId).select('name email role templeId isActive mustChangePassword');
    if (!user) {
      return next(ApiError.unauthorized('User account associated with this session no longer exists.'));
    }

    if (!user.isActive) {
      return next(ApiError.unauthorized('Your account has been deactivated. Please contact administration.'));
    }

    // 5. Attach safe user metadata to req.user
    req.user = {
      userId: user._id as Types.ObjectId,
      id: user._id as Types.ObjectId,
      name: user.name,
      email: user.email,
      role: user.role,
      templeId: user.templeId,
      mustChangePassword: user.mustChangePassword,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * Reads JWT token if present and attaches req.user without failing if unauthenticated.
 */
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | null = null;

    if (req.cookies && (req.cookies[COOKIE_NAME] || req.cookies.token)) {
      token = (req.cookies[COOKIE_NAME] || req.cookies.token) as string;
    }

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    let decoded: DecodedToken;
    try {
      const verified = jwt.verify(token, ENV.JWT_SECRET as string);
      decoded = verified as DecodedToken;
    } catch {
      return next();
    }

    const user = await User.findById(decoded.userId).select(
      'name email role templeId isActive mustChangePassword'
    );

    if (user && user.isActive) {
      req.user = {
        userId: user._id as Types.ObjectId,
        id: user._id as Types.ObjectId,
        name: user.name,
        email: user.email,
        role: user.role,
        templeId: user.templeId,
        mustChangePassword: user.mustChangePassword,
      };
    }

    next();
  } catch {
    next();
  }
};

/**
 * Role-Based Authorization Middleware
 * Enforces that authenticated user possesses one of the allowed roles.
 * @param allowedRoles Allowed roles: DEVOTEE, ADMIN, TEMPLE_AUTHORITY
 */
export const requireRole = (...allowedRoles: (string | readonly string[])[]): RequestHandler => {
  const roles = allowedRoles.flat();
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required before role verification'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to access this resource'));
    }

    next();
  };
};

/**
 * Temple Isolation Middleware
 * Enforces that a TEMPLE_AUTHORITY can only access resources belonging to their assigned templeId.
 * Never trusts a templeId provided by the client frontend.
 * Derives the authority's allowed temple from req.user.templeId.
 * ADMIN accounts retain global supervisory access.
 */
export function requireTempleAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void;
export function requireTempleAccess(
  extractor?: TempleIdExtractor
): RequestHandler;
export function requireTempleAccess(
  arg1?: Request | TempleIdExtractor,
  arg2?: Response,
  arg3?: NextFunction
): RequestHandler | void {
  // If called directly as middleware: requireTempleAccess(req, res, next)
  if (typeof arg3 === 'function') {
    const req = arg1 as Request;
    const res = arg2 as Response;
    const next = arg3 as NextFunction;
    const extractor: TempleIdExtractor = (r) =>
      r?.params?.templeId || r?.params?.id || (r?.query?.templeId as string) || r?.body?.templeId;
    return executeTempleAccessCheck(extractor, req, res, next);
  }

  // Otherwise called as higher-order factory: requireTempleAccess(extractor)
  const getRequestedTempleId: TempleIdExtractor =
    typeof arg1 === 'function'
      ? (arg1 as TempleIdExtractor)
      : (r) => r.params?.templeId || r.params?.id || (r.query?.templeId as string) || r.body?.templeId;

  return (req: Request, res: Response, next: NextFunction) =>
    executeTempleAccessCheck(getRequestedTempleId, req, res, next);
}

const executeTempleAccessCheck = (
  getRequestedTempleId: TempleIdExtractor | undefined,
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  // Admins retain platform-wide oversight
  if (req.user.role === USER_ROLES.ADMIN) {
    return next();
  }

  // Temple Authorities must strictly belong to their assigned temple
  if (req.user.role === USER_ROLES.TEMPLE_AUTHORITY) {
    if (!req.user.templeId) {
      return next(ApiError.forbidden('Access denied: No temple is assigned to this authority account'));
    }

    // If a specific target temple is specified in request params/query/body, check match
    if (getRequestedTempleId) {
      const requestedTempleId = getRequestedTempleId(req);
      if (requestedTempleId && requestedTempleId.toString() !== req.user.templeId.toString()) {
        return next(
          ApiError.forbidden(
            'Security policy violation: You are only authorized to access your assigned temple'
          )
        );
      }
    }

    // Securely enforce req.templeId from authenticated user session
    req.templeId = req.user.templeId;
    return next();
  }

  return next(ApiError.forbidden('Devotee accounts are not authorized to access temple administration'));
};

/**
 * Devotee Ownership Middleware
 * Ensures a DEVOTEE can only access their own resources (e.g. bookings, profile).
 * ADMIN users retain platform oversight.
 *
 * @param getRequestedUserId Extractor function: (req) => userId
 */
export const requireSelfOrAdmin = (getRequestedUserId?: UserIdExtractor): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    const targetUserId = getRequestedUserId
      ? getRequestedUserId(req)
      : req.params.userId || req.body?.userId;
    if (!targetUserId || targetUserId.toString() !== req.user.userId.toString()) {
      return next(ApiError.forbidden('You are only authorized to access your own resources'));
    }

    next();
  };
};

export default {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireTempleAccess,
  requireSelfOrAdmin,
};
