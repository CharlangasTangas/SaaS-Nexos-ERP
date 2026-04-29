import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

/**
 * AppModule — módulo raíz de Nexos ERP API
 *
 * Estructura de módulos (se irán agregando en sus respectivos tracks):
 * - HealthModule       → NX-P1-002 (este archivo)
 * - ConfigModule       → NX-P2-001
 * - PrismaModule       → NX-P2-001
 * - AuthModule         → NX-P2-007 / NX-P2-008
 * - TenantsModule      → NX-P2-006
 * - ProductsModule     → NX-P3-003
 * - InventoryModule    → NX-P3-005
 * - CustomersModule    → NX-P3-008
 * - SalesModule        → NX-P3-010
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
