import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/request.interface';

/**
 * RolesGuard — third guard in the chain.
 *
 * Checks if the authenticated user has at least one of the
 * required roles specified by @Roles() decorator.
 *
 * If no @Roles() is set, access is allowed.
 * SUPERADMIN check: if user.isSuperadmin is true and 'SUPERADMIN' is
 * in the required roles, access is granted.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required → allow
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user found.');
    }

    // Check SUPERADMIN
    if (requiredRoles.includes('SUPERADMIN') && user.isSuperadmin) {
      return true;
    }

    // Check if user has at least one required role
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient role. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
