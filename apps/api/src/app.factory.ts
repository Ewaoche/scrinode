import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.config';
import type { ApiEnv } from '@scrinode/validation';

/**
 * Builds the API with its security configuration applied.
 *
 * Extracted from main.ts because there are now two entry points — the
 * long-lived server (`main.ts`, used locally and by any container deployment)
 * and the serverless handler (`api/index.ts`, used on Vercel). Both must apply
 * the §33 baseline identically.
 *
 * Duplicating this across entry points would be the obvious way to lose it:
 * helmet, the CORS allow-list, the body cap and `x-powered-by` are each a
 * single call, and a second entry point that forgets one fails no test while
 * serving traffic. The e2e health test builds a bare testing module and so
 * covers none of it, which is exactly the gap this closes.
 *
 * What stays out: `listen()` and `enableShutdownHooks()`. Both are properties
 * of owning a process, which a serverless invocation does not.
 */
export async function createApp(env: ApiEnv = loadEnv()): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The API serves JSON to two known frontends; it renders nothing and is
    // never embedded. Defaults are therefore restrictive.
    bodyParser: true,
  });

  configureApp(app, env);

  return app;
}

/**
 * Applies the §33 security baseline to an already-created app.
 *
 * Separate from `createApp` so a test that builds the module its own way can
 * still assert against the real configuration rather than a copy of it.
 */
export function configureApp(app: NestExpressApplication, env: ApiEnv): void {
  app.use(
    helmet({
      // No HTML is served, so a content security policy has nothing to
      // govern. Frame and sniffing protections still apply to error bodies.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    }),
  );

  // Explicit allow-list rather than a wildcard: the API serves credentialed
  // requests, and the schema rejects '*' outright (AGENTS.md §33).
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  });

  // Reject oversized payloads before they are parsed. Scrinode's writes are
  // notes and workspace blocks, not uploads.
  app.useBodyParser('json', { limit: '1mb' });

  // Request validation is applied per-route with ZodValidationPipe, using the
  // schemas in @scrinode/validation. See src/common/zod-validation.pipe.ts.

  // Never advertise the framework to an attacker fingerprinting the stack.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
}
