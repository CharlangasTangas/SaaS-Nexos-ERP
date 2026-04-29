import { z } from 'zod';

export const InviteUserSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(2).max(200),
  roleId: z.string().uuid(),
});

export type InviteUserDto = z.infer<typeof InviteUserSchema>;
