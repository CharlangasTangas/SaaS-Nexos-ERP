import { z } from 'zod';

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  businessType: z
    .enum(['GREENHOUSE', 'MEAT_PROCESSING', 'DISTRIBUTOR', 'OTHER'])
    .optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
