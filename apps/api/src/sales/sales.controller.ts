import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, UpdateSaleStatusDto, SaleQueryDto } from './dto/create-sale.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Permissions('sales:write')
  @ApiOperation({ summary: 'Create a new sale and deduct inventory' })
  create(@Body() createSaleDto: CreateSaleDto, @CurrentUser() user: any) {
    return this.salesService.create(createSaleDto, user.sub);
  }

  @Get()
  @Permissions('sales:read')
  @ApiOperation({ summary: 'Get sales with pagination and filters' })
  findAll(@Query() query: SaleQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  @Permissions('sales:read')
  @ApiOperation({ summary: 'Get a specific sale by ID' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id/status')
  @Permissions('sales:write')
  @ApiOperation({ summary: 'Update sale status (e.g. Cancel to revert stock)' })
  updateStatus(
    @Param('id') id: string, 
    @Body() updateSaleStatusDto: UpdateSaleStatusDto,
    @CurrentUser() user: any
  ) {
    return this.salesService.updateStatus(id, updateSaleStatusDto, user.sub);
  }
}
