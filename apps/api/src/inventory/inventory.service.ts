import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AdjustInventoryDto, InventoryQueryDto } from './dto/adjust-inventory.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async adjust(dto: AdjustInventoryDto, userId: string) {
    const tenantId = this.prisma.currentTenantId;

    return this.prisma.$transaction(async (tx) => {
      // Get or create inventory record
      let inventory = await tx.inventory.findUnique({
        where: {
          tenantId_productId_warehouseId: {
            tenantId,
            productId: dto.productId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            tenantId,
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            quantity: 0,
          },
        });
      }

      // Safe concurrency update
      const increment = dto.type === 'IN' ? dto.quantity : -dto.quantity;
      
      const updated = await tx.$queryRaw`
        UPDATE inventory
        SET quantity = quantity + ${increment}, updated_at = NOW()
        WHERE id = ${inventory.id}::uuid AND tenant_id = ${tenantId}::uuid
        RETURNING *
      ` as any[];

      if (!updated.length) {
        throw new BadRequestException('Failed to update inventory');
      }

      const finalQuantity = Number(updated[0].quantity);
      if (finalQuantity < 0) {
        throw new BadRequestException('Insufficient stock: stock cannot be negative');
      }

      // Record movement
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          inventoryId: inventory.id,
          type: dto.type,
          quantity: dto.quantity,
          referenceType: 'MANUAL',
          userId,
          notes: dto.notes,
        },
      });

      return {
        inventory: updated[0],
        movement,
      };
    });
  }

  async findAll(query: InventoryQueryDto) {
    return this.prisma.$transaction(async (tx) => {
      return tx.inventory.findMany({
        where: {
          productId: query.productId,
          warehouseId: query.warehouseId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, minStock: true } },
          warehouse: { select: { id: true, name: true } },
        },
        take: query.limit,
      });
    });
  }

  async findMovements(inventoryId: string) {
    return this.prisma.$transaction(async (tx) => {
      return tx.stockMovement.findMany({
        where: { inventoryId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, fullName: true } },
        },
      });
    });
  }
}
