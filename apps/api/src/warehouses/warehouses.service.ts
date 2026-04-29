import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(createWarehouseDto: CreateWarehouseDto) {
    return this.prisma.$transaction(async (tx) => {
      // If setting as default, unset previous default
      if (createWarehouseDto.isDefault) {
        await tx.warehouse.updateMany({
          where: { tenantId: this.prisma.currentTenantId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }

      // Check if this is the first warehouse, if so, make it default automatically
      if (!createWarehouseDto.isDefault) {
        const count = await tx.warehouse.count({
          where: { tenantId: this.prisma.currentTenantId, deletedAt: null },
        });
        if (count === 0) {
          createWarehouseDto.isDefault = true;
        }
      }

      return tx.warehouse.create({
        data: {
          tenantId: this.prisma.currentTenantId,
          name: createWarehouseDto.name,
          address: createWarehouseDto.address,
          isDefault: createWarehouseDto.isDefault,
        },
      });
    });
  }

  async findAll() {
    return this.prisma.$transaction(async (tx) => {
      return tx.warehouse.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    });
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.$transaction(async (tx) => {
      return tx.warehouse.findUnique({
        where: { id, deletedAt: null },
      });
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return warehouse;
  }

  async update(id: string, updateWarehouseDto: UpdateWarehouseDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      if (updateWarehouseDto.isDefault) {
        await tx.warehouse.updateMany({
          where: { 
            tenantId: this.prisma.currentTenantId, 
            isDefault: true, 
            id: { not: id },
            deletedAt: null 
          },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: updateWarehouseDto,
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Unset default if it was default
      return tx.warehouse.update({
        where: { id },
        data: { deletedAt: new Date(), isDefault: false },
      });
    });
  }
}
