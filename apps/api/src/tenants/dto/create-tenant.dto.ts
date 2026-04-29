import { z } from 'zod';

export const CreateTenantSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Slug must be lowercase alphanumeric with optional hyphens, no leading/trailing hyphens',
    ),
  name: z.string().min(2).max(200),
  businessType: z.enum([
    'GREENHOUSE',
    'MEAT_PROCESSING',
    'DISTRIBUTOR',
    'OTHER',
  ]),
  settings: z.record(z.unknown()).optional().default({}),
});

export type CreateTenantDto = z.infer<typeof CreateTenantSchema>;
