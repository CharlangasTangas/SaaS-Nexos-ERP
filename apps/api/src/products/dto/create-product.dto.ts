import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  unit: z.string().min(1).max(20),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});

export class CreateProductDto extends createZodDto(CreateProductSchema) {}

export const ProductQuerySchema = z.object({
  search: z.string().optional(),
  sku: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().or(z.string().transform(v => v === 'true')).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().or(z.string().transform(v => parseInt(v, 10))).optional().default(20),
});

export class ProductQueryDto extends createZodDto(ProductQuerySchema) {}
