import { createZodDto } from 'nestjs-zod';
import { CreateWarehouseSchema } from './create-warehouse.dto';

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

export class UpdateWarehouseDto extends createZodDto(UpdateWarehouseSchema) {}
