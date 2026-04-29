import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaService } from './tenant-prisma.service';

/**
 * PrismaModule — provides database access throughout the application.
 *
 * Exports:
 * - PrismaService: raw client for global tables (tenants, permissions)
 * - TenantPrismaService: tenant-isolated client with RLS enforcement
 */
@Global()
@Module({
  providers: [PrismaService, TenantPrismaService],
  exports: [PrismaService, TenantPrismaService],
})
export class PrismaModule {}
