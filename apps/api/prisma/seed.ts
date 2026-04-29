/**
 * Main seed entry point for Prisma.
 * Dispatches to sub-seeders based on arguments or runs dev seed by default.
 *
 * Usage:
 *   npx prisma db seed              → runs dev seed
 *   pnpm --filter api db:seed       → runs dev seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Nexos ERP — Database Seeder\n');

  // Import and run seeds
  const { seedPermissions } = await import('./seeds/permissions.seed');
  const { seedDev } = await import('./seeds/dev.seed');

  // Always ensure permissions exist first
  // Note: seedPermissions is auto-run when imported, but we call it here for clarity
  console.log('Step 1: Permissions');
  // Permissions are seeded on import

  console.log('\nStep 2: Dev data');
  // Dev data is seeded on import

  console.log('\n🎉 All seeds complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
