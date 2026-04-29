import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateSaleDto, UpdateSaleStatusDto, SaleQueryDto } from './dto/create-sale.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private async generateSaleNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Simplistic counter (in production, use sequence or specialized table)
    const count = await tx.sale.count({
      where: {
        tenantId,
        number: { startsWith: prefix }
      }
    });

    return `${prefix}-${(count + 1).toString().padStart(4, '0')}`;
  }

  async create(createSaleDto: CreateSaleDto, userId: string) {
    const tenantId = this.prisma.currentTenantId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Get default warehouse
      const defaultWarehouse = await tx.warehouse.findFirst({
        where: { tenantId, isDefault: true, deletedAt: null },
      });

      if (!defaultWarehouse) {
        throw new BadRequestException('No default warehouse configured for inventory reduction');
      }

      // 2. Validate customer and credit limit
      let customer = null;
      if (createSaleDto.customerId) {
        customer = await tx.customer.findUnique({
          where: { id: createSaleDto.customerId, tenantId, deletedAt: null },
        });
        if (!customer) throw new NotFoundException('Customer not found');
      }

      // 3. Process items and check stock
      let subtotal = 0;
      const processedItems = [];

      for (const item of createSaleDto.items) {
        // Validate product
        const product = await tx.product.findUnique({
          where: { id: item.productId, tenantId, deletedAt: null, isActive: true },
        });
        if (!product) throw new BadRequestException(`Product ${item.productId} not available`);

        // Check stock via raw update to lock and reduce
        const updatedInventory = await tx.$queryRaw`
          UPDATE inventory
          SET quantity = quantity - ${item.quantity}, updated_at = NOW()
          WHERE tenant_id = ${tenantId}::uuid
            AND product_id = ${item.productId}::uuid
            AND warehouse_id = ${defaultWarehouse.id}::uuid
            AND quantity >= ${item.quantity}
          RETURNING *
        ` as any[];

        if (!updatedInventory.length) {
          throw new BadRequestException(`Insufficient stock for product ${product.name} (${product.sku}) in default warehouse`);
        }

        const itemSubtotal = (item.unitPrice * item.quantity) - item.discount;
        subtotal += itemSubtotal;

        processedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          subtotal: itemSubtotal,
          inventoryId: updatedInventory[0].id,
        });
      }

      // 4. Calculate totals
      const taxRate = 0.16; // Standard config or from DB
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      // 5. Check credit limit
      if (customer && customer.creditLimit > 0) {
        // Find existing unpaid sales total? 
        // For now, simple check: is sale total > credit limit?
        if (total > customer.creditLimit) {
          throw new BadRequestException('Credit limit exceeded');
        }
      }

      // 6. Generate sale number
      const saleNumber = await this.generateSaleNumber(tx, tenantId);

      // 7. Create sale
      const sale = await tx.sale.create({
        data: {
          tenantId,
          number: saleNumber,
          customerId: createSaleDto.customerId,
          userId,
          status: 'CONFIRMED',
          subtotal,
          tax,
          total,
          notes: createSaleDto.notes,
          items: {
            create: processedItems.map(pi => ({
              tenantId,
              productId: pi.productId,
              quantity: pi.quantity,
              unitPrice: pi.unitPrice,
              discount: pi.discount,
              subtotal: pi.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      // 8. Create stock movements
      for (const pi of processedItems) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryId: pi.inventoryId,
            type: 'OUT',
            quantity: pi.quantity,
            referenceType: 'SALE',
            referenceId: sale.id,
            userId,
            notes: `Sale ${sale.number}`,
          },
        });
      }

      return sale;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  async findAll(query: SaleQueryDto) {
    const { customerId, status, cursor, limit } = query;
    const tenantId = this.prisma.currentTenantId;

    const where: Prisma.SaleWhereInput = { tenantId, deletedAt: null };

    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    return this.prisma.$transaction(async (tx) => {
      const items = await tx.sale.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, name: true } } },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        data: items,
        meta: { nextCursor, limit },
      };
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.$transaction(async (tx) => {
      return tx.sale.findUnique({
        where: { id, tenantId: this.prisma.currentTenantId, deletedAt: null },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } }
          },
          customer: { select: { id: true, name: true, email: true, taxId: true } },
          user: { select: { id: true, fullName: true } }
        },
      });
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    return sale;
  }

  async updateStatus(id: string, updateSaleStatusDto: UpdateSaleStatusDto, userId: string) {
    const tenantId = this.prisma.currentTenantId;

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id, tenantId, deletedAt: null },
        include: { items: true },
      });

      if (!sale) throw new NotFoundException('Sale not found');

      if (sale.status === updateSaleStatusDto.status) {
        return sale; // No change
      }

      if (sale.status === 'CANCELLED') {
        throw new BadRequestException('Cannot change status of a cancelled sale');
      }

      if (updateSaleStatusDto.status === 'CANCELLED') {
        // Revert stock
        const defaultWarehouse = await tx.warehouse.findFirst({
          where: { tenantId, isDefault: true, deletedAt: null },
        });

        for (const item of sale.items) {
          if (!item.productId) continue;

          // Find inventory to revert
          const inventory = await tx.inventory.findUnique({
            where: {
              tenantId_productId_warehouseId: {
                tenantId,
                productId: item.productId,
                warehouseId: defaultWarehouse!.id,
              }
            }
          });

          if (inventory) {
            await tx.$queryRaw`
              UPDATE inventory
              SET quantity = quantity + ${item.quantity}, updated_at = NOW()
              WHERE id = ${inventory.id}::uuid AND tenant_id = ${tenantId}::uuid
            `;

            await tx.stockMovement.create({
              data: {
                tenantId,
                inventoryId: inventory.id,
                type: 'IN',
                quantity: item.quantity,
                referenceType: 'SALE',
                referenceId: sale.id,
                userId,
                notes: \`Sale \${sale.number} cancelled\`,
              },
            });
          }
        }
      }

      return tx.sale.update({
        where: { id },
        data: { status: updateSaleStatusDto.status },
      });
    });
  }
}
