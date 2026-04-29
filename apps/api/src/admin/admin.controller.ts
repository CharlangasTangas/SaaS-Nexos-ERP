import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateTenantSchema,
  type CreateTenantDto,
} from '../tenants/dto/create-tenant.dto';
import {
  UpdateTenantSchema,
  type UpdateTenantDto,
} from '../tenants/dto/update-tenant.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SUPERADMIN } from '../common/constants/roles';

/**
 * AdminController — global admin endpoints protected by SUPERADMIN role.
 * These operate outside tenant context.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('tenants')
  @Roles(SUPERADMIN)
  @ApiOperation({ summary: 'List all tenants (SUPERADMIN only)' })
  async listTenants(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.tenantsService.list({
      status: status as any,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { success: true, ...result };
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @Roles(SUPERADMIN)
  @ApiOperation({ summary: 'Create a tenant (SUPERADMIN only)' })
  async createTenant(@Body() body: any) {
    const dto: CreateTenantDto = CreateTenantSchema.parse(body);
    const tenant = await this.tenantsService.create(dto);
    return { success: true, data: tenant };
  }

  @Patch('tenants/:id')
  @Roles(SUPERADMIN)
  @ApiOperation({ summary: 'Update a tenant (SUPERADMIN only)' })
  async updateTenant(@Param('id') id: string, @Body() body: any) {
    const dto: UpdateTenantDto = UpdateTenantSchema.parse(body);
    const tenant = await this.tenantsService.update(id, dto);
    return { success: true, data: tenant };
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(SUPERADMIN)
  @ApiOperation({ summary: 'Archive a tenant (SUPERADMIN only)' })
  async archiveTenant(@Param('id') id: string) {
    const tenant = await this.tenantsService.archive(id);
    return { success: true, data: tenant, message: 'Tenant archived.' };
  }
}
