/**
 * System roles for RBAC.
 * These are created as is_system=true roles when a new tenant is set up.
 */
export const SYSTEM_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
  VIEWER: 'VIEWER',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const ALL_SYSTEM_ROLES = Object.values(SYSTEM_ROLES);

/**
 * SUPERADMIN is not a tenant role — it's a flag on the user record.
 * Grants access to /admin/* endpoints regardless of tenant.
 */
export const SUPERADMIN = 'SUPERADMIN' as const;
