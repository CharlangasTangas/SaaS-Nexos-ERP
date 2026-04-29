import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto, InventoryQueryDto } from './dto/adjust-inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get current inventory levels' })
  findAll(@Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Post('adjust')
  @Permissions('inventory:adjust')
  @ApiOperation({ summary: 'Manually adjust inventory (IN/OUT)' })
  adjust(
    @Body() adjustInventoryDto: AdjustInventoryDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.adjust(adjustInventoryDto, user.sub);
  }

  @Get(':id/movements')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Get stock movements for a specific inventory record' })
  findMovements(@Param('id') id: string) {
    return this.inventoryService.findMovements(id);
  }
}
