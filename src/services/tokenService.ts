import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { Types } from 'mongoose';
import { ENV } from '../config/env.js';

export const COOKIE_NAME = 'devasetu_token';

export interface UserTokenSource {
  _id?: Types.ObjectId | string;
  id?: Types.ObjectId | string;
  userId?: Types.ObjectId | string;
  role: string;
  templeId?: Types.ObjectId | string | null;
}

export interface TokenPayload {
  userId: Types.ObjectId | string;
  role: string;
  templeId?: Types.ObjectId | string;
}

/**
 * Generate a JWT token containing minimal claims
 * @param user - User document or minimal user fields
 * @returns Signed JWT token
 */
export const generateToken = (user: UserTokenSource): string => {
  const userId = user._id || user.id || user.userId;
  if (!userId) {
    throw new Error('Cannot generate token: user identifier is missing.');
  }

  const payload: TokenPayload = {
    userId,
    role: user.role,
    ...(user.templeId && { templeId: user.templeId }),
  };

  return jwt.sign(payload, ENV.JWT_SECRET as string, {
    expiresIn: (ENV.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });
};

/**
 * Set HTTP-only authentication cookie on Express response
 * @param res - Express response object
 * @param token - Signed JWT token
 */
export const setAuthCookie = (res: Response, token: string): void => {
  const isProduction = ENV.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

/**
 * Clear the authentication cookie from Express response
 * @param res - Express response object
 */
export const clearAuthCookie = (res: Response): void => {
  const isProduction = ENV.NODE_ENV === 'production';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 0,
    path: '/',
  });
};

export default {
  COOKIE_NAME,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
};
