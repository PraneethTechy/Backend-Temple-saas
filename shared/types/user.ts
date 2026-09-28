/**
 * DevaSetu User & Authentication Types
 */
import type { ID, Timestamps } from './common.js';
import type { UserRole } from './enums.js';

export interface User extends Timestamps {
  _id: ID;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  templeId?: ID | null;
  isActive: boolean;
  isEmailVerified?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
}

export type AuthenticatedUser = Omit<User, 'password'>;

export interface PublicUser {
  _id: ID;
  name: string;
}

export interface JwtPayload {
  id: ID;
  role: UserRole;
  templeId?: ID | null;
  mustChangePassword?: boolean;
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface DevoteeRegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthSessionResponse {
  user: AuthenticatedUser;
  token?: string;
}
