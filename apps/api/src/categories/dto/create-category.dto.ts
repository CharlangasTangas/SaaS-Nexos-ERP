import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(150),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
