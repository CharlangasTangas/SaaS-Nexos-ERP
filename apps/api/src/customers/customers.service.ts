import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateCustomerDto, CustomerQueryDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(createCustomerDto: CreateCustomerDto) {
    if (createCustomerDto.email) {
      const existing = await this.prisma.global.customer.findFirst({
        where: { tenantId: this.prisma.currentTenantId, email: createCustomerDto.email, deletedAt: null },
      });
      if (existing) {
        throw new BadRequestException('Customer with this email already exists');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.customer.create({
        data: {
          tenantId: this.prisma.currentTenantId,
          name: createCustomerDto.name,
          taxId: createCustomerDto.taxId,
          email: createCustomerDto.email,
          phone: createCustomerDto.phone,
          address: createCustomerDto.address,
          creditLimit: createCustomerDto.creditLimit,
        },
      });
    });
  }

  async findAll(query: CustomerQueryDto) {
    const { search, taxId, cursor, limit } = query;
    
    const where: Prisma.CustomerWhereInput = { deletedAt: null };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (taxId) {
      where.taxId = { contains: taxId, mode: 'insensitive' };
    }

    return this.prisma.$transaction(async (tx) => {
      const items = await tx.customer.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
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
    const customer = await this.prisma.$transaction(async (tx) => {
      return tx.customer.findUnique({
        where: { id, deletedAt: null },
      });
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    await this.findOne(id);

    if (updateCustomerDto.email) {
      const existing = await this.prisma.global.customer.findFirst({
        where: { tenantId: this.prisma.currentTenantId, email: updateCustomerDto.email, deletedAt: null },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Customer with this email already exists');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.customer.update({
        where: { id },
        data: updateCustomerDto,
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      return tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }
}
