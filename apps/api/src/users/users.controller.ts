import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { InviteUserSchema, type InviteUserDto } from './dto/invite-user.dto';
import { AssignRoleSchema, type AssignRoleDto } from './dto/assign-role.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import type { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('users')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Slug', required: true })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'List users in the current tenant' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const users = await this.usersService.list(user.tenantId);
    return { success: true, data: users };
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Invite a new user to the tenant' })
  async invite(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto: InviteUserDto = InviteUserSchema.parse(body);
    const result = await this.usersService.invite(
      dto,
      user.tenantId,
      user.tenantSlug,
      user.sub,
    );
    return { success: true, data: result };
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an invited user' })
  async activate(@Body() body: { token: string; password: string }) {
    const result = await this.usersService.activate(body.token, body.password);
    return { success: true, data: result };
  }

  @Patch(':id/deactivate')
  @Permissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Deactivate a user' })
  async deactivate(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.deactivate(userId, user.tenantId);
    return { success: true, message: 'User deactivated.' };
  }

  @Patch(':id/activate')
  @Permissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Reactivate a user' })
  async reactivate(
    @Param('id') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usersService.reactivate(userId, user.tenantId);
    return { success: true, message: 'User activated.' };
  }

  @Patch(':id/role')
  @Permissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRole(
    @Param('id') userId: string,
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const dto: AssignRoleDto = AssignRoleSchema.parse(body);
    await this.usersService.assignRole(userId, dto.roleId, user.tenantId);
    return { success: true, message: 'Role assigned.' };
  }
}
