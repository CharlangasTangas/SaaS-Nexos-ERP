import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (no auth required).
 * Skips JwtAuthGuard and TenantGuard.
 *
 * @example @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
