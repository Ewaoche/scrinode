import { Logger } from '@nestjs/common';
import { createApp } from './app.factory';
import { loadEnv } from './config/env.config';

/**
 * The long-lived server entry point.
 *
 * Used for local development and for any container deployment. Vercel uses
 * `api/index.ts` instead, which shares `createApp` — everything in §33's
 * baseline lives there so the two paths cannot diverge.
 */
async function bootstrap(): Promise<void> {
  // Validate before Nest starts, so a bad environment fails immediately and
  // with a readable message rather than part-way through wiring.
  const env = loadEnv();

  const app = await createApp(env);

  // Close in-flight requests and release the connection pool on SIGTERM.
  //
  // Nest does not listen for termination signals unless this is called, so
  // without it a redeploy kills the process mid-request and leaves Postgres
  // holding connections until they time out — which a rolling restart can
  // turn into exhausted max_connections (DatabaseModule.onApplicationShutdown
  // is what actually closes the pool).
  //
  // Only meaningful for a process we own. A serverless invocation is frozen
  // rather than signalled, so the handler does not call this.
  app.enableShutdownHooks();

  // Bind to every interface, not just loopback.
  //
  // Without an explicit host, Node may bind to localhost only, and inside a
  // container that means nothing outside it can connect — including the
  // healthcheck and any reverse proxy. The container boundary is the
  // isolation here, not the bind address.
  await app.listen(env.API_PORT, '0.0.0.0');

  Logger.log(`API listening on port ${env.API_PORT}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
