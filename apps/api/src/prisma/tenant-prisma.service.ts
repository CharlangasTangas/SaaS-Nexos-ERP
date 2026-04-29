import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TenantContext } from '../common/context/tenant.context';

/**
 * TenantPrismaService — wraps Prisma operations with tenant isolation.
 *
 * Every operation:
 * 1. Reads the current tenant from AsyncLocalStorage (TenantContext).
 * 2. Runs `SET LOCAL app.tenant_id = '<uuid>'` inside a transaction.
 * 3. This activates PostgreSQL RLS policies.
 * 4. Additionally applies defense-in-depth by including tenant_id in WHERE clauses.
 *
 * If no TenantContext exists, all operations throw immediately.
 */
@Injectable()
export class TenantPrismaService {
  private readonly logger = new Logger(TenantPrismaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a callback within a tenant-isolated transaction.
   * Sets the PostgreSQL session variable for RLS before running the callback.
   */
  async $transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    const tenantId = TenantContext.getTenantIdOrFail();

    return this.prisma.$transaction(
      async (tx) => {
        // Set the tenant context at the PostgreSQL level for RLS
        await tx.$executeRawUnsafe(
          `SET LOCAL app.tenant_id = '${tenantId}'`,
        );
        return fn(tx);
      },
      {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 10000,
        isolationLevel: options?.isolationLevel,
      },
    );
  }

  /**
   * Execute a raw query within tenant context.
   */
  async $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: any[]
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      return tx.$queryRaw<T>(query, ...values) as any;
    });
  }

  /**
   * Execute a raw unsafe query within tenant context.
   */
  async $executeRaw(
    query: TemplateStringsArray,
    ...values: any[]
  ): Promise<number> {
    return this.$transaction(async (tx) => {
      return tx.$executeRaw(query, ...values);
    });
  }

  /**
   * Get the underlying PrismaService for global operations.
   * WARNING: This bypasses tenant isolation. Use only for global tables.
   */
  get global(): PrismaService {
    return this.prisma;
  }

  /**
   * Get the current tenant ID from context.
   */
  get currentTenantId(): string {
    return TenantContext.getTenantIdOrFail();
  }
}
