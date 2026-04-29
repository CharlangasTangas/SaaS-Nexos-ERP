import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate/:saleId')
  @Permissions('sales:write') // Requires sales permission to generate invoice
  @ApiOperation({ summary: 'Generate a PDF invoice for a sale' })
  generate(@Param('saleId') saleId: string) {
    return this.invoicesService.generateForSale(saleId);
  }

  @Get()
  @Permissions('sales:read')
  @ApiOperation({ summary: 'Get all invoices' })
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':id/download')
  @Permissions('sales:read')
  @ApiOperation({ summary: 'Get a pre-signed URL to download the invoice PDF' })
  getDownloadUrl(@Param('id') id: string) {
    return this.invoicesService.getDownloadUrl(id);
  }
}
