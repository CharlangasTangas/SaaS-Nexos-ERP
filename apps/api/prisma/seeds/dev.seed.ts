/**
 * seed:dev — Creates test data for development.
 * Creates 2 tenants, OWNER users, base roles, and permissions.
 *
 * Usage: pnpm --filter api seed:dev
 *
 * Test credentials:
 * - admin@invernadero-demo.local / password123
 * - admin@distribuidora-demo.local / password123
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SYSTEM_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'];

const ALL_PERMISSIONS = [
  'products:read', 'products:write', 'inventory:read', 'inventory:adjust',
  'sales:read', 'sales:create', 'customers:read', 'customers:write',
  'reports:view', 'reports:export', 'users:manage', 'roles:manage',
  'tenants:manage',
];

const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== 'tenants:manage'),
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

const DEV_TENANTS = [
  {
    slug: 'invernadero-demo',
    name: 'Invernadero Demo S.A.',
    businessType: 'GREENHOUSE' as const,
    users: [
      {
        email: 'admin@invernadero-demo.local',
        fullName: 'Admin Invernadero',
        role: 'OWNER',
        password: 'password123',
      },
      {
        email: 'manager@invernadero-demo.local',
        fullName: 'Manager Invernadero',
        role: 'MANAGER',
        password: 'password123',
      },
      {
        email: 'viewer@invernadero-demo.local',
        fullName: 'Viewer Invernadero',
        role: 'VIEWER',
        password: 'password123',
      },
    ],
  },
  {
    slug: 'distribuidora-demo',
    name: 'Distribuidora Demo S.A.',
    businessType: 'DISTRIBUTOR' as const,
    users: [
      {
        email: 'admin@distribuidora-demo.local',
        fullName: 'Admin Distribuidora',
        role: 'OWNER',
        password: 'password123',
      },
      {
        email: 'operator@distribuidora-demo.local',
        fullName: 'Operator Distribuidora',
        role: 'OPERATOR',
        password: 'password123',
      },
    ],
  },
];

async function seedDev() {
  console.log('🌱 Starting dev seed...\n');

  // 1. Seed global permissions
  console.log('🔑 Seeding permissions...');
  const permMap: Record<string, string> = {};
  for (const code of ALL_PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: `Permission: ${code}` },
    });
    permMap[code] = perm.id;
  }
  console.log(`   ✅ ${ALL_PERMISSIONS.length} permissions ready.\n`);

  // 2. Create tenants and users
  for (const tenantData of DEV_TENANTS) {
    console.log(`🏢 Tenant: ${tenantData.slug}`);

    // Upsert tenant
    let tenant = await prisma.tenant.findUnique({
      where: { slug: tenantData.slug },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          slug: tenantData.slug,
          name: tenantData.name,
          businessType: tenantData.businessType,
          settings: {},
        },
      });
      console.log(`   ✅ Tenant created.`);
    } else {
      console.log(`   ⚡ Tenant already exists.`);
    }

    // Create system roles
    const roleMap: Record<string, string> = {};
    for (const roleName of SYSTEM_ROLES) {
      let role = await prisma.role.findFirst({
        where: { tenantId: tenant.id, name: roleName },
      });

      if (!role) {
        role = await prisma.role.create({
          data: {
            tenantId: tenant.id,
            name: roleName,
            description: `System role: ${roleName}`,
            isSystem: true,
          },
        });
      }
      roleMap[roleName] = role.id;

      // Assign permissions to role
      const codes = ROLE_PERMISSIONS_MAP[roleName] ?? [];
      for (const code of codes) {
        const permId = permMap[code];
        if (!permId) continue;

        const existing = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
        });

        if (!existing) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permId,
              tenantId: tenant.id,
            },
          });
        }
      }
    }
    console.log(`   ✅ ${SYSTEM_ROLES.length} roles configured.`);

    // Create users
    for (const userData of tenantData.users) {
      const existingUser = await prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          email: userData.email,
        },
      });

      if (!existingUser) {
        const passwordHash = await argon2.hash(userData.password, {
          type: argon2.argon2id,
        });

        await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: userData.email,
            passwordHash,
            fullName: userData.fullName,
            roleId: roleMap[userData.role],
            isActive: true,
          },
        });
        console.log(`   ✅ User: ${userData.email} (${userData.role})`);
      } else {
        console.log(`   ⚡ User: ${userData.email} already exists.`);
      }
    }

    console.log('');
  }

  console.log('🎉 Dev seed complete!');
  console.log('\nTest credentials:');
  for (const t of DEV_TENANTS) {
    for (const u of t.users) {
      console.log(
        `  ${u.email} / ${u.password} (tenant: ${t.slug}, role: ${u.role})`,
      );
    }
  }
}

seedDev()
  .catch((e) => {
    console.error('❌ Dev seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedDev };
