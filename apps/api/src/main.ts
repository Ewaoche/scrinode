import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.config';

async function bootstrap(): Promise<void> {
  // Validate before Nest starts, so a bad environment fails immediately and
  // with a readable message rather than part-way through wiring.
  const env = loadEnv();

  const app = await NestFactory.create(AppModule);

  // Request validation is applied per-route with ZodValidationPipe, using the
  // schemas in @scrinode/validation. See src/common/zod-validation.pipe.ts.

  await app.listen(env.API_PORT);

  Logger.log(`API listening on port ${env.API_PORT}`, 'Bootstrap');
}

void bootstrap();
