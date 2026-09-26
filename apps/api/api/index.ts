import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApp } from '../src/app.factory';

/**
 * Vercel serverless entry point.
 *
 * Nest is built once and reused while the instance stays warm. A cold
 * invocation pays the full bootstrap; a warm one pays nothing, which is why
 * the promise is cached rather than the resolved app — two concurrent cold
 * requests would otherwise each build their own Nest.
 *
 * Differences from `main.ts`, both deliberate:
 *
 *   - No `listen()`. Vercel owns the socket and hands us a request.
 *   - No `enableShutdownHooks()`. A function is frozen between invocations
 *     rather than signalled, so SIGTERM never arrives and the pool is not
 *     closed on our schedule. This is why DATABASE_URL must be Neon's
 *     *pooled* endpoint: connections outlive the invocation that opened them,
 *     and PgBouncer is what stops them accumulating.
 */
let cached: Promise<NestExpressApplication> | undefined;

function app(): Promise<NestExpressApplication> {
  cached ??= createApp().then(async (instance) => {
    // `init()` rather than `listen()`: wires the app and runs lifecycle hooks
    // without binding a port.
    await instance.init();
    return instance;
  });

  return cached;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const instance = await app();

  // Hand the raw request to Express, which Nest is mounted on.
  instance.getHttpAdapter().getInstance()(request, response);
}
