import { Injectable, Logger } from '@nestjs/common';
import type { Tenant, TenantStatus, BusinessType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

/**
 * TenantsService — manages tenant lifecycle.
 * Uses raw PrismaService since tenants is a global table (no RLS).
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find an ACTIVE tenant by slug.
   * Used by TenantMiddleware for request resolution.
   */
  async findActiveBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        slug,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Find tenant by slug (any status).
   */
  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  /**
   * Find tenant by ID.
   */
  async findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new tenant.
   */
  async create(data: CreateTenantDto): Promise<Tenant> {
    return this.prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        businessType: data.businessType as BusinessType,
        settings: (data.settings ?? {}) as any,
      },
    });
  }

  /**
   * Update a tenant.
   */
  async update(id: string, data: UpdateTenantDto): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.businessType && {
          businessType: data.businessType as BusinessType,
        }),
        ...(data.status && { status: data.status as TenantStatus }),
        ...(data.settings && { settings: data.settings as any }),
      },
    });
  }

  /**
   * Archive (soft-delete) a tenant.
   */
  async archive(id: string): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  /**
   * List all tenants with optional filters.
   */
  async list(params?: {
    status?: TenantStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: Tenant[]; total: number }> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const where = params?.status ? { status: params.status } : {};

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total };
  }
}
