import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { AuditService } from './audit.service';
import type { AuthenticatedUser } from '../common/interfaces/request.interface';
import { TenantContext } from '../common/context/tenant.context';

/**
 * AuditInterceptor — global interceptor that logs all mutations
 * (POST, PUT, PATCH, DELETE) to the audit_logs table.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  // Methods that constitute mutations
  private readonly MUTATION_METHODS = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  // Map HTTP methods to audit actions
  private readonly METHOD_TO_ACTION: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method.toUpperCase();

    // Only audit mutations
    if (!this.MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    // Skip auth routes from detailed audit (login is logged separately)
    const url = request.url;
    if (url.startsWith('/auth/') || url === '/health') {
      return next.handle();
    }

    const user = (request as any).user as AuthenticatedUser | undefined;
    const tenantStore = TenantContext.getStore();
    const tenantId = tenantStore?.tenantId ?? user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    // Extract entity from URL path
    const pathParts = url.replace(/^\/api\//, '').split('/').filter(Boolean);
    const entity = pathParts[0] ?? 'unknown';
    const entityId = pathParts[1] ?? undefined;

    const action = this.METHOD_TO_ACTION[method] ?? method;

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          // Fire and forget — don't await
          this.auditService
            .log({
              tenantId,
              userId: user?.sub,
              action,
              entity: entity.charAt(0).toUpperCase() + entity.slice(1),
              entityId,
              diff: request.body as any,
              ip: request.ip,
              userAgent: request.headers['user-agent'],
            })
            .catch((err) =>
              this.logger.error('Audit log failed', err),
            );
        },
      }),
    );
  }
}
