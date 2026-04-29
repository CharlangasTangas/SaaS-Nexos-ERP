import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateRoleDto = z.infer<typeof CreateRoleSchema>;

export const UpdateRoleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

export type UpdateRoleDto = z.infer<typeof UpdateRoleSchema>;
