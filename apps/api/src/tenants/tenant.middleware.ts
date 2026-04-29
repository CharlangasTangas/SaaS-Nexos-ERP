import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { TenantsService } from './tenants.service';
import { TenantContext } from '../common/context/tenant.context';

/**
 * TenantMiddleware — resolves the tenant for every request.
 *
 * Reads the `X-Tenant-Slug` header and:
 * - If missing → 400 BadRequest
 * - If tenant not found or inactive → 404 NotFound
 * - If valid → runs the request inside a TenantContext
 *
 * Compatible with frontend that extracts slug from subdomain:
 * empresa1.lvh.me → X-Tenant-Slug: empresa1
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly tenantsService: TenantsService) {}

  async use(
    req: FastifyRequest['raw'],
    res: FastifyReply['raw'],
    next: () => void,
  ): Promise<void> {
    const slug = (req as any).headers?.['x-tenant-slug'] as string | undefined;

    if (!slug) {
      throw new BadRequestException(
        'Missing X-Tenant-Slug header. The tenant must be identified via subdomain.',
      );
    }

    const tenant = await this.tenantsService.findActiveBySlug(slug);

    if (!tenant) {
      throw new NotFoundException(
        `Tenant "${slug}" not found or is not active.`,
      );
    }

    // Run the rest of the request inside the tenant context
    TenantContext.run(
      {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
      () => next(),
    );
  }
}
