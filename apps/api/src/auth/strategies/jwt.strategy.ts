import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../common/interfaces/request.interface';

interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  permissions: string[];
  isSuperadmin: boolean;
}

/**
 * JWT Strategy for Passport.
 * Extracts the JWT from the Authorization: Bearer header
 * and validates it against the access secret.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    });
  }

  /**
   * Called after JWT is verified. The return value is attached to req.user.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      isSuperadmin: payload.isSuperadmin ?? false,
    };
  }
}
