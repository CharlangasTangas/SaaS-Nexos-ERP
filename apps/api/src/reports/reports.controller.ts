import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Get main dashboard KPIs and alerts' })
  getDashboardMetrics() {
    return this.reportsService.getDashboardMetrics();
  }

  @Get('sales/export')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Export all sales to CSV format' })
  exportSalesCsv(@Res() res: Response) {
    // Note: The service will stream directly to the response
    this.reportsService.exportSalesCsv(res);
  }
}
