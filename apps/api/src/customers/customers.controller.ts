import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Permissions('customers:write')
  @ApiOperation({ summary: 'Create a new customer' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get customers with pagination and filters' })
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Get a specific customer by ID' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Permissions('customers:write')
  @ApiOperation({ summary: 'Update a specific customer' })
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Permissions('customers:write')
  @ApiOperation({ summary: 'Soft delete a customer' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
