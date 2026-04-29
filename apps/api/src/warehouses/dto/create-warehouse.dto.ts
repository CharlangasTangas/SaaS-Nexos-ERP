import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateWarehouseSchema = z.object({
  name: z.string().min(1).max(150),
  address: z.string().nullable().optional(),
  isDefault: z.boolean().optional().default(false),
});

export class CreateWarehouseDto extends createZodDto(CreateWarehouseSchema) {}
