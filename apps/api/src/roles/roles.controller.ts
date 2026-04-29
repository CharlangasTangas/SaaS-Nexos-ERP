import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  type CreateRoleDto,
  type UpdateRoleDto,
} from './dto/create-role.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import type { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('roles')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Slug', required: true })
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'List all roles in the tenant' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const roles = await this.rolesService.list(user.tenantId);
    return { success: true, data: roles };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Get a role by ID' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const role = await this.rolesService.findById(id, user.tenantId);
    return { success: true, data: role };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Create a custom role' })
  async create(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto: CreateRoleDto = CreateRoleSchema.parse(body);
    const role = await this.rolesService.create(dto, user.tenantId);
    return { success: true, data: role };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto: UpdateRoleDto = UpdateRoleSchema.parse(body);
    const role = await this.rolesService.update(id, dto, user.tenantId);
    return { success: true, data: role };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.ROLES_MANAGE)
  @ApiOperation({ summary: 'Delete a custom role' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.rolesService.delete(id, user.tenantId);
    return { success: true, message: 'Role deleted.' };
  }
}
