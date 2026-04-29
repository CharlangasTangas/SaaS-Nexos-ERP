/**
 * seed:tenant <slug> — Creates base roles and permissions for a tenant.
 * Can be called standalone or during signup.
 *
 * Usage: pnpm --filter api seed:tenant <slug>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'];

const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  OWNER: [
    'products:read', 'products:write', 'inventory:read', 'inventory:adjust',
    'sales:read', 'sales:create', 'customers:read', 'customers:write',
    'reports:view', 'reports:export', 'users:manage', 'roles:manage',
    'tenants:manage',
  ],
  ADMIN: [
    'products:read', 'products:write', 'inventory:read', 'inventory:adjust',
    'sales:read', 'sales:create', 'customers:read', 'customers:write',
    'reports:view', 'reports:export', 'users:manage', 'roles:manage',
  ],
  MANAGER: [
    'products:read', 'products:write', 'inventory:read', 'inventory:adjust',
    'sales:read', 'sales:create', 'customers:read', 'customers:write',
    'reports:view', 'reports:export',
  ],
  OPERATOR: [
    'products:read', 'inventory:read', 'sales:read', 'sales:create',
    'customers:read',
  ],
  VIEWER: [
    'products:read', 'inventory:read', 'sales:read', 'customers:read',
    'reports:view',
  ],
};

async function seedTenant(slug: string) {
  console.log(`🏢 Seeding tenant: ${slug}`);

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`❌ Tenant "${slug}" not found.`);
    process.exit(1);
  }

  // Get all permissions
  const allPerms = await prisma.permission.findMany();
  const permCodeToId = Object.fromEntries(allPerms.map((p) => [p.code, p.id]));

  for (const roleName of SYSTEM_ROLES) {
    // Upsert role
    const existingRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: roleName },
    });

    let roleId: string;
    if (existingRole) {
      roleId = existingRole.id;
      console.log(`  ⚡ Role ${roleName} already exists.`);
    } else {
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: roleName,
          description: `System role: ${roleName}`,
          isSystem: true,
        },
      });
      roleId = role.id;
      console.log(`  ✅ Role ${roleName} created.`);
    }

    // Assign permissions
    const permCodes = ROLE_PERMISSIONS_MAP[roleName] ?? [];
    for (const code of permCodes) {
      const permId = permCodeToId[code];
      if (!permId) continue;

      // Upsert role-permission
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: { roleId, permissionId: permId },
        },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: { roleId, permissionId: permId, tenantId: tenant.id },
        });
      }
    }
  }

  console.log(`✅ Tenant "${slug}" seeded with roles and permissions.`);
}

// CLI entry point
const slug = process.argv[2];
if (slug) {
  seedTenant(slug)
    .catch((e) => {
      console.error('❌ Tenant seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
} else {
  console.error('Usage: seed:tenant <slug>');
  process.exit(1);
}

export { seedTenant };
