import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new warehouse' })
  create(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.warehousesService.create(createWarehouseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all warehouses' })
  findAll() {
    return this.warehousesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific warehouse by ID' })
  findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a specific warehouse' })
  update(@Param('id') id: string, @Body() updateWarehouseDto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a warehouse' })
  remove(@Param('id') id: string) {
    return this.warehousesService.remove(id);
  }
}
