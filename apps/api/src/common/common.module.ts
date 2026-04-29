import { Module, Global } from '@nestjs/common';

/**
 * CommonModule — provides shared utilities, constants, and pipes
 * across the entire application.
 */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class CommonModule {}
