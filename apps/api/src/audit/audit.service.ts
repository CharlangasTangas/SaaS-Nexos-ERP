import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  diff?: any;
  ip?: string;
  userAgent?: string;
}

/**
 * AuditService — writes audit logs for all mutations.
 * Uses raw PrismaService since audit_logs has its own RLS.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          diff: entry.diff ?? {},
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Audit logging should never break the request
      this.logger.error('Failed to write audit log', error);
    }
  }

  /**
   * Query audit logs for a tenant.
   */
  async query(
    tenantId: string,
    params?: {
      entity?: string;
      entityId?: string;
      userId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    const where: any = { tenantId };
    if (params?.entity) where.entity = params.entity;
    if (params?.entityId) where.entityId = params.entityId;
    if (params?.userId) where.userId = params.userId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }
}
