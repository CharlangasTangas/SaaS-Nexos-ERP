import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryTree } from '@nexos/types';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    if (createCategoryDto.parentId) {
      const parent = await this.prisma.global.category.findUnique({
        where: { id: createCategoryDto.parentId, tenantId: this.prisma.currentTenantId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.category.create({
        data: {
          tenantId: this.prisma.currentTenantId,
          name: createCategoryDto.name,
          parentId: createCategoryDto.parentId,
          description: createCategoryDto.description,
        },
      });
    });
  }

  async findAll() {
    return this.prisma.$transaction(async (tx) => {
      return tx.category.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    });
  }

  async findTree() {
    const categories = await this.findAll();
    const map = new Map<string, CategoryTree>();
    const roots: CategoryTree[] = [];

    // Initialize map
    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] } as unknown as CategoryTree);
    }

    // Build tree
    for (const cat of categories) {
      const node = map.get(cat.id)!;
      if (cat.parentId) {
        const parent = map.get(cat.parentId);
        if (parent && parent.children) {
          parent.children.push(node);
        } else {
          // If parent is missing (deleted or invalid), treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.$transaction(async (tx) => {
      return tx.category.findUnique({
        where: { id, deletedAt: null },
      });
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Verify existence
    await this.findOne(id);

    // Prevent cycles
    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }

      const parent = await this.findOne(updateCategoryDto.parentId);
      
      // Check if new parent is a descendant of the current category
      let currentParentId = parent.parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          throw new BadRequestException('Cannot set a descendant as parent (cycle detected)');
        }
        const currentParent = await this.findOne(currentParentId);
        currentParentId = currentParent.parentId;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.category.update({
        where: { id },
        data: updateCategoryDto,
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    
    // Check for children
    const childrenCount = await this.prisma.$transaction(async (tx) => {
      return tx.category.count({
        where: { parentId: id, deletedAt: null },
      });
    });

    if (childrenCount > 0) {
      throw new BadRequestException('Cannot delete category with active children');
    }

    // Soft delete
    return this.prisma.$transaction(async (tx) => {
      return tx.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}
