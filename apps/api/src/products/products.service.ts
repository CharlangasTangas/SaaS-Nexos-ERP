import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateProductDto, ProductQueryDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(createProductDto: CreateProductDto) {
    // Check SKU uniqueness
    const existingSku = await this.prisma.global.product.findUnique({
      where: {
        tenantId_sku: { tenantId: this.prisma.currentTenantId, sku: createProductDto.sku },
      },
    });

    if (existingSku) {
      throw new BadRequestException(`Product with SKU ${createProductDto.sku} already exists`);
    }

    if (createProductDto.categoryId) {
      const category = await this.prisma.global.category.findUnique({
        where: { id: createProductDto.categoryId, tenantId: this.prisma.currentTenantId, deletedAt: null },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          tenantId: this.prisma.currentTenantId,
          sku: createProductDto.sku,
          name: createProductDto.name,
          description: createProductDto.description,
          categoryId: createProductDto.categoryId,
          unit: createProductDto.unit,
          price: createProductDto.price,
          cost: createProductDto.cost,
          minStock: createProductDto.minStock,
          isActive: createProductDto.isActive,
          metadata: createProductDto.metadata ?? {},
        },
      });
    });
  }

  async findAll(query: ProductQueryDto) {
    const { search, sku, categoryId, isActive, cursor, limit } = query;
    
    const where: Prisma.ProductWhereInput = { deletedAt: null };

    if (search) {
      // Using pg_trgm optimized ILIKE via Prisma's insensitive contains
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (sku) {
      where.sku = sku;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.$transaction(async (tx) => {
      const items = await tx.product.findMany({
        where,
        take: limit + 1, // take one extra to determine if there's a next page
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop(); // remove the extra item
        nextCursor = nextItem!.id;
      }

      return {
        data: items,
        meta: {
          nextCursor,
          limit,
        },
      };
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.$transaction(async (tx) => {
      return tx.product.findUnique({
        where: { id, deletedAt: null },
        include: { category: true },
      });
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    if (updateProductDto.sku) {
      const existingSku = await this.prisma.global.product.findUnique({
        where: {
          tenantId_sku: { tenantId: this.prisma.currentTenantId, sku: updateProductDto.sku },
        },
      });
      if (existingSku && existingSku.id !== id) {
        throw new BadRequestException(`Product with SKU ${updateProductDto.sku} already exists`);
      }
    }

    if (updateProductDto.categoryId) {
      const category = await this.prisma.global.category.findUnique({
        where: { id: updateProductDto.categoryId, tenantId: this.prisma.currentTenantId, deletedAt: null },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Convert metadata undefined to Prisma.JsonNull if needed, or just let Prisma handle it
      return tx.product.update({
        where: { id },
        data: {
          ...updateProductDto,
          metadata: updateProductDto.metadata === undefined ? undefined : updateProductDto.metadata,
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      return tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
    });
  }
}
