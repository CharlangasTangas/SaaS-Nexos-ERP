import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateSaleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
});

export const CreateSaleSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(CreateSaleItemSchema).min(1),
});

export class CreateSaleDto extends createZodDto(CreateSaleSchema) {}

export const UpdateSaleStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']),
});

export class UpdateSaleStatusDto extends createZodDto(UpdateSaleStatusSchema) {}

export const SaleQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().or(z.string().transform(v => parseInt(v, 10))).optional().default(20),
});

export class SaleQueryDto extends createZodDto(SaleQuerySchema) {}
