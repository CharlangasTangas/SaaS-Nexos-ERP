import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../constants/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to set required permissions for a route.
 * Used by PermissionsGuard.
 *
 * @example @Permissions('products:write', 'inventory:adjust')
 */
export const Permissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
