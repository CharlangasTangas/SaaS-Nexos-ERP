import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@nexos/types';

/**
 * HealthController
 *
 * GET /health — endpoint de healthcheck para Docker y monitoreo.
 * No requiere autenticación ni tenant context.
 *
 * Será extendido con checks reales de Postgres/Redis cuando se
 * implemente PrismaModule y RedisModule (NX-P2-001).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Healthcheck del API' })
  @ApiResponse({ status: 200, description: 'API operativa' })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.0.0',
    };
  }
}
