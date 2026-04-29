import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — base Prisma client for Nexos ERP.
 *
 * This is the RAW client without tenant isolation.
 * Use this ONLY for:
 * - Global tables (tenants, permissions)
 * - Operations that explicitly don't need tenant scoping
 * - Internal operations like tenant lookup during middleware
 *
 * For tenant-scoped operations, use TenantPrismaService instead.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('🔌 Prisma disconnected from PostgreSQL');
  }
}
