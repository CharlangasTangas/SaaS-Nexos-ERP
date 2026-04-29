import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdjustInventorySchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER']),
  quantity: z.number().positive(),
  notes: z.string().nullable().optional(),
});

export class AdjustInventoryDto extends createZodDto(AdjustInventorySchema) {}

export const InventoryQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  limit: z.number().or(z.string().transform(v => parseInt(v, 10))).optional().default(50),
});

export class InventoryQueryDto extends createZodDto(InventoryQuerySchema) {}
