import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  /**
   * List all roles in the tenant.
   */
  async list(tenantId: string) {
    return this.tenantPrisma.$transaction(async (tx) => {
      return tx.role.findMany({
        where: { tenantId },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  /**
   * Get a single role by ID.
   */
  async findById(id: string, tenantId: string) {
    const role = await this.tenantPrisma.$transaction(async (tx) => {
      return tx.role.findFirst({
        where: { id, tenantId },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    });

    if (!role) throw new NotFoundException('Role not found.');
    return role;
  }

  /**
   * Create a custom role for the tenant.
   */
  async create(dto: CreateRoleDto, tenantId: string) {
    // Check name uniqueness within tenant
    const existing = await this.prisma.role.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description,
          isSystem: false,
        },
      });

      // Assign permissions if provided
      if (dto.permissionIds && dto.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permId) => ({
            roleId: role.id,
            permissionId: permId,
            tenantId,
          })),
        });
      }

      return role;
    });
  }

  /**
   * Update a role. System roles cannot be renamed.
   */
  async update(id: string, dto: UpdateRoleDto, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.isSystem && dto.name) {
      throw new BadRequestException('Cannot rename system roles.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
        },
      });

      // Update permissions if provided
      if (dto.permissionIds !== undefined) {
        // Remove existing
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });
        // Add new
        if (dto.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permId) => ({
              roleId: id,
              permissionId: permId,
              tenantId,
            })),
          });
        }
      }

      return updated;
    });
  }

  /**
   * Delete a custom role. System roles cannot be deleted.
   */
  async delete(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.isSystem) {
      throw new BadRequestException('Cannot delete system roles.');
    }

    // Check if any users have this role
    const usersWithRole = await this.prisma.user.count({
      where: { roleId: id, tenantId, deletedAt: null },
    });
    if (usersWithRole > 0) {
      throw new BadRequestException(
        `Cannot delete role: ${usersWithRole} user(s) still assigned.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });
  }
}
