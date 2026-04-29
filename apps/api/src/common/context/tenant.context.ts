import { AsyncLocalStorage } from 'async_hooks';

/**
 * Tenant context store shape.
 * Populated by TenantMiddleware, consumed by PrismaService.
 */
export interface TenantStore {
  tenantId: string;
  tenantSlug: string;
  userId?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * TenantContext — AsyncLocalStorage-based context for multi-tenant isolation.
 *
 * Workflow:
 * 1. TenantMiddleware resolves the tenant from X-Tenant-Slug header.
 * 2. Calls TenantContext.run({ tenantId, tenantSlug }, callback).
 * 3. Any downstream code can call TenantContext.getStore() to read tenant info.
 * 4. PrismaService uses this to SET LOCAL app.tenant_id before queries.
 *
 * If TenantContext is missing when a tenant-scoped operation runs, an error is thrown.
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * Run a callback within the given tenant context.
   */
  static run<T>(store: TenantStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  /**
   * Get the current tenant store, or undefined if not within a tenant context.
   */
  static getStore(): TenantStore | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the tenant ID or throw if not in a tenant context.
   * Use this in tenant-scoped operations.
   */
  static getTenantIdOrFail(): string {
    const store = this.storage.getStore();
    if (!store?.tenantId) {
      throw new Error(
        'TenantContext is missing. This operation requires a tenant context. ' +
          'Ensure the request passes through TenantMiddleware.',
      );
    }
    return store.tenantId;
  }

  /**
   * Get the full store or throw if not in a tenant context.
   */
  static getStoreOrFail(): TenantStore {
    const store = this.storage.getStore();
    if (!store?.tenantId) {
      throw new Error('TenantContext is missing.');
    }
    return store;
  }
}
