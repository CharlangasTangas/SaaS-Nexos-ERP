import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../interfaces/request.interface';

/**
 * Extracts the authenticated user from the request.
 * Populated by JwtAuthGuard / Passport JWT strategy.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
