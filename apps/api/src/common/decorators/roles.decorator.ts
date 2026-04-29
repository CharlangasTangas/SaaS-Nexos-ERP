import { SetMetadata } from '@nestjs/common';
import type { SystemRole } from '../constants/roles';

export const ROLES_KEY = 'roles';

/**
 * Decorator to set required roles for a route.
 * Used by RolesGuard to enforce RBAC.
 *
 * @example @Roles('ADMIN', 'OWNER')
 */
export const Roles = (...roles: (SystemRole | 'SUPERADMIN')[]) =>
  SetMetadata(ROLES_KEY, roles);
