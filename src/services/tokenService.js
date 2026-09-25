import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export const COOKIE_NAME = 'devasetu_token';

/**
 * Generate a JWT token containing minimal claims
 * @param {Object} user - User document or minimal user fields
 * @returns {string} Signed JWT token
 */
export const generateToken = (user) => {
  const payload = {
    userId: user._id || user.id || user.userId,
    role: user.role,
    ...(user.templeId && { templeId: user.templeId }),
  };

  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Set HTTP-only authentication cookie on Express response
 * @param {Object} res - Express response object
 * @param {string} token - Signed JWT token
 */
export const setAuthCookie = (res, token) => {
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
 * @param {Object} res - Express response object
 */
export const clearAuthCookie = (res) => {
  const isProduction = ENV.NODE_ENV === 'production';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 0,
    path: '/',
  });
};
