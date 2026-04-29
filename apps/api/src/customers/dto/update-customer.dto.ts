import { createZodDto } from 'nestjs-zod';
import { CreateCustomerSchema } from './create-customer.dto';

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export class UpdateCustomerDto extends createZodDto(UpdateCustomerSchema) {}
