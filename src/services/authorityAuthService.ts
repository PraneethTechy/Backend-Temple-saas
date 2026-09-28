import crypto from 'crypto';
import type { ClientSession, Types } from 'mongoose';
import { User, USER_ROLES } from '../models/index.js';
import { ApiError } from '../utils/apiError.js';

export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
}

export interface CreateAuthorityUserParams {
  name: string;
  email: string;
  phone?: string;
  templeId: Types.ObjectId | string;
  temporaryPassword?: string;
}

export interface CreateAuthorityUserOptions {
  session?: ClientSession;
}

export interface CreateAuthorityUserResult {
  user: Record<string, any>;
  temporaryPassword: string;
}

/**
 * Validates whether a password satisfies strong password policy:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * 
 * @param password - Candidate password
 * @returns Validation outcome with error message
 */
export const validateStrongPassword = (password: string): PasswordValidationResult => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  return { isValid: true, message: '' };
};

/**
 * Generates a high-entropy, cryptographically strong temporary password.
 * Format: DS@ + 1 uppercase + random hex + symbol (meets all complexity requirements)
 */
export const generateSecureTemporaryPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const special = '!@#$%^&*';
  const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
  const randomSpecial = special.charAt(Math.floor(Math.random() * special.length));
  const hexPart = crypto.randomBytes(4).toString('hex'); // 8 hex digits
  return `DS@${randomChar}${hexPart}${randomSpecial}`;
};

/**
 * Internal service to provision a Temple Authority account.
 * Called exclusively by Admin approval/onboarding workflows.
 */
export const createTempleAuthorityUser = async (
  { name, email, phone, templeId, temporaryPassword: customPassword }: CreateAuthorityUserParams,
  options: CreateAuthorityUserOptions = {}
): Promise<CreateAuthorityUserResult> => {
  if (!templeId) {
    throw ApiError.badRequest('A valid templeId is required to create a Temple Authority account');
  }

  const queryOptions = options.session ? { session: options.session } : {};

  // Check if an account already exists with this email
  const existingUser = await User.findOne({ email: email.toLowerCase() }, null, queryOptions);
  if (existingUser) {
    throw ApiError.conflict(`An account with email ${email} already exists.`);
  }

  let temporaryPassword = customPassword;
  if (temporaryPassword) {
    const { isValid, message } = validateStrongPassword(temporaryPassword);
    if (!isValid) {
      throw ApiError.badRequest(`Temporary password policy violation: ${message}`);
    }
  } else {
    temporaryPassword = generateSecureTemporaryPassword();
  }

  // Create user (User model's pre-save hook will hash this temporary password)
  const authorityUser = new User({
    name,
    email: email.toLowerCase().trim(),
    phone: phone ? phone.trim() : '',
    password: temporaryPassword,
    role: USER_ROLES.TEMPLE_AUTHORITY,
    templeId,
    mustChangePassword: true,
    isEmailVerified: true, // Pre-verified via administrative onboarding
    isActive: true,
  });

  await authorityUser.save(queryOptions);

  return {
    user: authorityUser.toJSON(),
    temporaryPassword,
  };
};

export default {
  validateStrongPassword,
  generateSecureTemporaryPassword,
  createTempleAuthorityUser,
};
