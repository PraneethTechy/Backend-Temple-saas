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
});

export const ALL_ROLES = Object.values(USER_ROLES);
