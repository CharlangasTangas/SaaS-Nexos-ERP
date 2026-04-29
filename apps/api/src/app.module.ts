import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { RedisModule } from './common/redis/redis.module';

// Feature modules
import { HealthModule } from './health/health.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';

// Middleware
import { TenantMiddleware } from './tenants/tenant.middleware';

// Guards (applied globally)
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantGuard } from './auth/guards/tenant.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

// Interceptors
import { AuditInterceptor } from './audit/audit.interceptor';

/**
 * AppModule — módulo raíz de Nexos ERP API
 *
 * Guard execution order (global):
 * 1. RateLimitGuard → rate limiting per user/IP
 * 2. JwtAuthGuard → validates JWT (skips @Public routes)
 * 3. TenantGuard → verifies JWT tenant matches request tenant
 * 4. RolesGuard → checks @Roles() requirements
 * 5. PermissionsGuard → checks @Permissions() requirements
 *
 * Interceptor:
 * - AuditInterceptor → logs all mutations to audit_logs table
 *
 * Middleware:
 * - TenantMiddleware → resolves tenant from X-Tenant-Slug header
 *   Applied to all routes EXCEPT: /health, /auth/signup, /admin/*
 */
@Module({
  imports: [
    // Infrastructure
    PrismaModule,
    RedisModule,
    CommonModule,

    // Features
    HealthModule,
    TenantsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    AuditModule,
    AdminModule,
  ],
  providers: [
    // Global guards — order matters!
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        '/health',
        '/auth/signup',
        '/auth/refresh',
        '/admin/(.*)',
      )
      .forRoutes('*');
  }
}
