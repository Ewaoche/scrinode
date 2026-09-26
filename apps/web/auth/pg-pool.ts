import { Pool } from 'pg';

/**
 * PostgreSQL pool for the Auth.js adapter.
 *
 * Connection is deferred until first use rather than established at import.
 * `next build` evaluates route modules without runtime environment present,
 * so connecting at module scope would fail the build — and would attach a
 * configuration error to the build rather than to the deployment that is
 * actually misconfigured.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a
 * new pool on every reload until Postgres refuses connections. The pool is
 * cached on globalThis so development reuses one.
 */
declare global {
  var _scrinodePgPool: Pool | undefined;
}

function create(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for authentication');
  }

  const pool = new Pool({
    connectionString,

    // The reader app runs serverless on Vercel, where each instance handles
    // few concurrent requests but many instances may exist at once. A small
    // per-instance pool keeps the total within Postgres's max_connections.
    max: 5,

    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,

    ...(process.env.DATABASE_SSL === 'true'
      ? // rejectUnauthorized stays true: accepting any certificate would
        // make TLS decorative.
        { ssl: { rejectUnauthorized: true } }
      : {}),
  });

  // Without a listener, `pg` emits an unhandled 'error' event when an idle
  // client fails, which terminates the process. The pool discards the broken
  // connection itself; this only stops it taking the app down.
  pool.on('error', (error: Error) => {
    console.error(`[auth] idle database client error: ${error.message}`);
  });

  return pool;
}

let cached: Pool | undefined;

export function getPool(): Pool {
  // One pool per process in production; one pool across hot reloads in
  // development, where module scope is discarded but globalThis survives.
  if (process.env.NODE_ENV === 'production') {
    return (cached ??= create());
  }

  return (globalThis._scrinodePgPool ??= create());
}
