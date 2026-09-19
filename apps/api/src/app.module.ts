import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from './config/env.config';
import { DatabaseModule } from './database/database.module';
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

    /**
     * Rate limiting — AGENTS.md §33.
     *
     * Two windows: a short one absorbing bursts, and a longer one capping
     * sustained abuse. Zedek endpoints call paid AI providers, so they will
     * carry their own stricter limits on top of these defaults.
     */
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'sustained', ttl: 60_000, limit: 120 },
    ]),

    DatabaseModule,
    HealthModule,
  ],
  providers: [
    {
      // Applied globally rather than per controller, so a new endpoint is
      // protected by default rather than by remembering a decorator.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
