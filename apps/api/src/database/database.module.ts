import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';
import { DatabaseHealthIndicator } from './database.health';

/**
 * PostgreSQL connection pool.
 *
 * Scrinode uses the `pg` driver directly rather than an ORM. Retrieval
 * depends on pgvector operators and index hints (`<=>`, `hnsw.ef_search`)
 * that ORMs either do not express or express badly, and AGENTS.md §19 makes
 * that retrieval path load-bearing rather than incidental.
 *
 * One pooled connection set per process. Repositories wrap queries; domain
 * services must never import the driver directly (AGENTS.md §8).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool => {
        const pool = new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),

          // Postgres allocates a backend process per connection, so an
          // oversized pool exhausts the server rather than improving
          // throughput.
          max: config.get<number>('DATABASE_POOL_MAX') ?? 10,

          // Fail fast rather than hanging a request behind a dead database.
          connectionTimeoutMillis: 10_000,

          // Release idle connections so a traffic spike does not leave the
          // pool permanently at its maximum.
          idleTimeoutMillis: 30_000,

          ...(config.get<boolean>('DATABASE_SSL')
            ? // A managed database presents a certificate from its own
              // authority. `rejectUnauthorized` stays true: accepting any
              // certificate would make TLS decorative.
              { ssl: { rejectUnauthorized: true } }
            : {}),
        });

        // An idle client can fail between checkouts — a network drop, or the
        // server closing the connection. Without a listener, `pg` emits an
        // unhandled 'error' event, which terminates the process.
        //
        // The pool discards the broken connection itself; this only stops it
        // from taking the application down with it.
        pool.on('error', (error: Error) => {
          new Logger('DatabasePool').error(`Idle client error: ${error.message}`);
        });

        return pool;
      },
    },
    DatabaseHealthIndicator,
  ],
  exports: [PG_POOL, DatabaseHealthIndicator],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Closes the pool on shutdown.
   *
   * Without this, a redeploy leaves connections held until Postgres times
   * them out, and a rolling restart can exhaust `max_connections` with
   * connections belonging to processes that no longer exist.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
