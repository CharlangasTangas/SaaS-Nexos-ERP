/**
 * seed:permissions — Upserts all global permissions.
 * Idempotent: safe to run multiple times.
 *
 * Usage: pnpm --filter api seed:permissions
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { code: 'products:read', description: 'View products catalog' },
  { code: 'products:write', description: 'Create and edit products' },
  { code: 'inventory:read', description: 'View inventory levels' },
  { code: 'inventory:adjust', description: 'Adjust stock quantities' },
  { code: 'sales:read', description: 'View sales records' },
  { code: 'sales:create', description: 'Create new sales' },
  { code: 'customers:read', description: 'View customer list' },
  { code: 'customers:write', description: 'Create and edit customers' },
  { code: 'reports:view', description: 'View reports and dashboards' },
  { code: 'reports:export', description: 'Export reports to CSV/PDF' },
  { code: 'users:manage', description: 'Manage users and invitations' },
  { code: 'roles:manage', description: 'Manage roles and permissions' },
  { code: 'tenants:manage', description: 'Manage tenant settings' },
];

async function seedPermissions() {
  console.log('🔑 Seeding permissions...');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log(`✅ ${PERMISSIONS.length} permissions seeded.`);
}

seedPermissions()
  .catch((e) => {
    console.error('❌ Permission seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedPermissions, PERMISSIONS };
