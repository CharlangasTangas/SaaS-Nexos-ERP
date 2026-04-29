import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { TenantContext } from '../../common/context/tenant.context';
import type { AuthenticatedUser } from '../../common/interfaces/request.interface';

/**
 * TenantGuard — second guard in the chain (after JwtAuthGuard).
 *
 * Verifies that the authenticated user's tenant (from JWT)
 * matches the resolved tenant (from X-Tenant-Slug header / TenantContext).
 *
 * Prevents cross-tenant access even if a valid JWT is presented.
 * Superadmins bypass this check.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    // No user means JwtAuthGuard already allowed (public route)
    if (!user) return true;

    // Superadmins can access any tenant
    if (user.isSuperadmin) return true;

    // Get the tenant context from AsyncLocalStorage
    const tenantStore = TenantContext.getStore();

    // If no tenant context, this might be a global route
    if (!tenantStore) return true;

    // Verify the JWT tenant matches the request tenant
    if (user.tenantId !== tenantStore.tenantId) {
      throw new ForbiddenException(
        'Access denied. Your token belongs to a different tenant.',
      );
    }

    return true;
  }
}
