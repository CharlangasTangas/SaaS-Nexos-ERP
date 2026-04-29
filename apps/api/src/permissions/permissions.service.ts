import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PermissionsService — manages the global permissions catalog.
 * Permissions are global (no tenant_id), so we use raw PrismaService.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all available permissions.
   */
  async findAll() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Find permissions by their codes.
   */
  async findByCodes(codes: string[]) {
    return this.prisma.permission.findMany({
      where: { code: { in: codes } },
    });
  }

  /**
   * Find a single permission by code.
   */
  async findByCode(code: string) {
    return this.prisma.permission.findUnique({
      where: { code },
    });
  }
}
