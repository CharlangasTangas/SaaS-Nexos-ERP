import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RedisService } from '../redis/redis.service';
import type { AuthenticatedUser } from '../interfaces/request.interface';

/**
 * RateLimitGuard — enforces request rate limits using Redis.
 *
 * Rules:
 * - 100 req/min per authenticated user
 * - 10 req/min for login endpoint per IP+tenant
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const url = request.url;
    const ip = request.ip;

    // Login rate limiting: 10 req/min per IP + tenant
    if (url.includes('/auth/login')) {
      const tenantSlug =
        (request.headers['x-tenant-slug'] as string) ?? 'unknown';
      const key = `ratelimit:login:${ip}:${tenantSlug}`;
      const count = await this.redis.incrWithExpiry(key, 60);

      if (count > 10) {
        throw new HttpException(
          'Too many login attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    }

    // General rate limiting: 100 req/min per user
    const user = (request as any).user as AuthenticatedUser | undefined;
    if (user) {
      const key = `ratelimit:user:${user.sub}`;
      const count = await this.redis.incrWithExpiry(key, 60);

      if (count > 100) {
        throw new HttpException(
          'Rate limit exceeded. Maximum 100 requests per minute.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }
}
