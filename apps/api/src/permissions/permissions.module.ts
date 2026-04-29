import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available permissions' })
  async findAll() {
    const permissions = await this.permissionsService.findAll();
    return { success: true, data: permissions };
  }
}

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
