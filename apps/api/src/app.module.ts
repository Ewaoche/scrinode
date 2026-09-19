import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from './config/env.config';
import { HealthModule } from './health/health.module';

/**
 * Root module.
 *
 * Domain modules (scripture, study, zedek, workspaces, library) and the
 * globally guarded admin module (AGENTS.md §51) are registered here as they
 * are built.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Fails the boot on a misconfigured environment.
      validate: (config) => loadEnv(config as NodeJS.ProcessEnv),
    }),
    HealthModule,
  ],
})
export class AppModule {}
