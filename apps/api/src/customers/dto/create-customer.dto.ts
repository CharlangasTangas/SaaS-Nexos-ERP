import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  taxId: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  creditLimit: z.number().min(0).default(0),
});

export class CreateCustomerDto extends createZodDto(CreateCustomerSchema) {}

export const CustomerQuerySchema = z.object({
  search: z.string().optional(),
  taxId: z.string().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().or(z.string().transform(v => parseInt(v, 10))).optional().default(20),
});

export class CustomerQueryDto extends createZodDto(CustomerQuerySchema) {}
