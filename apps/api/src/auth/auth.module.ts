import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * AuthModule — provides authentication and authorization.
 *
 * Registers:
 * - PassportModule with JWT strategy
 * - JwtModule for token signing/verification
 * - AuthService for business logic
 * - AuthController for HTTP endpoints
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      signOptions: {
        expiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
      },
    }),
    TenantsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
