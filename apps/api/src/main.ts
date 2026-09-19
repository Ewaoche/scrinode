import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.config';

async function bootstrap(): Promise<void> {
  // Validate before Nest starts, so a bad environment fails immediately and
  // with a readable message rather than part-way through wiring.
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The API serves JSON to two known frontends; it renders nothing and is
    // never embedded. Defaults are therefore restrictive.
    bodyParser: true,
  });

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

  await app.listen(env.API_PORT);

  Logger.log(`API listening on port ${env.API_PORT}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
