/**
 * DevaSetu User Roles
 * Exactly three roles exist in the system:
 * - DEVOTEE: Public registration, books darshans, seva, experiences.
 * - ADMIN: Super administrator created via backend/CLI, approves temple registrations, manages platform.
 * - TEMPLE_AUTHORITY: Created upon Admin approval of temple registration, manages their assigned temple.
 */
export const USER_ROLES = Object.freeze({
  DEVOTEE: 'DEVOTEE',
  ADMIN: 'ADMIN',
  TEMPLE_AUTHORITY: 'TEMPLE_AUTHORITY',
} as const);

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const ALL_ROLES: readonly UserRole[] = Object.values(USER_ROLES);
