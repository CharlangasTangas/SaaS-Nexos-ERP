import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { Response } from 'express';
import { format } from '@fast-csv/format';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async getDashboardMetrics() {
    const tenantId = this.prisma.currentTenantId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Current month sales
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlySales = await tx.sale.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: 'CONFIRMED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { total: true },
        _count: { id: true },
      });

      // 2. Total revenue (all time)
      const totalRevenue = await tx.sale.aggregate({
        where: { tenantId, deletedAt: null, status: 'CONFIRMED' },
        _sum: { total: true },
      });

      // 3. Top products
      // Using raw query for grouping and sum across SaleItem
      const topProductsRaw = await tx.$queryRaw<any[]>`
        SELECT p.id as "productId", p.name as "name", SUM(si.quantity) as "soldQuantity"
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.tenant_id = ${tenantId}::uuid AND s.status = 'CONFIRMED' AND s.deleted_at IS NULL
        GROUP BY p.id, p.name
        ORDER BY "soldQuantity" DESC
        LIMIT 5
      `;

      // 4. Low stock alerts
      const lowStockAlerts = await tx.$queryRaw<any[]>`
        SELECT p.id as "productId", p.name as "name", p.min_stock as "minStock", i.quantity as "quantity"
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        WHERE i.tenant_id = ${tenantId}::uuid AND p.deleted_at IS NULL AND i.quantity <= p.min_stock
        ORDER BY i.quantity ASC
        LIMIT 10
      `;

      // 5. Recent sales
      const recentSales = await tx.sale.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: { select: { name: true } } },
      });

      // 6. Recent movements
      const recentMovements = await tx.stockMovement.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { inventory: { include: { product: { select: { name: true } } } } },
      });

      return {
        monthlySales: Number(monthlySales._sum.total || 0),
        totalRevenue: Number(totalRevenue._sum.total || 0),
        salesCount: monthlySales._count.id,
        topProducts: topProductsRaw.map((p: any) => ({ ...p, soldQuantity: Number(p.soldQuantity) })),
        lowStockAlerts: lowStockAlerts.map((p: any) => ({ ...p, minStock: Number(p.minStock), quantity: Number(p.quantity) })),
        recentSales,
        recentMovements,
      };
    });
  }

  async exportSalesCsv(res: Response) {
    const tenantId = this.prisma.currentTenantId;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_export.csv"');

    const csvStream = format({ headers: true });
    csvStream.pipe(res);

    // Use Prisma cursor or raw query stream if possible
    // Prisma does not natively stream, but we can iterate in batches
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const sales: any[] = await this.prisma.$transaction(async (tx) => {
        return tx.sale.findMany({
          where: { tenantId, deletedAt: null },
          take: 100,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { createdAt: 'asc' },
          include: { customer: true, user: true },
        });
      });

      if (sales.length === 0) {
        hasMore = false;
        break;
      }

      for (const sale of sales) {
        csvStream.write({
          Number: sale.number,
          Date: sale.createdAt.toISOString(),
          Customer: sale.customer?.name || 'Walk-in',
          User: sale.user?.fullName || 'System',
          Status: sale.status,
          Subtotal: sale.subtotal,
          Tax: sale.tax,
          Total: sale.total,
        });
      }

      cursor = sales[sales.length - 1].id;
    }

    csvStream.end();
  }
}
