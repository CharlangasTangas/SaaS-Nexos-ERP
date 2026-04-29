import { z } from 'zod';

export const SignupSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Slug must be lowercase alphanumeric with optional hyphens',
    ),
  companyName: z.string().min(2).max(200),
  businessType: z.enum([
    'GREENHOUSE',
    'MEAT_PROCESSING',
    'DISTRIBUTOR',
    'OTHER',
  ]),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(200),
});

export type SignupDto = z.infer<typeof SignupSchema>;
