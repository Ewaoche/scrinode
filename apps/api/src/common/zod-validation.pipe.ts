import { BadRequestException, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates request payloads with Zod.
 *
 * Scrinode validates with Zod via `@scrinode/validation` (AGENTS.md §40), so
 * schemas are shared between the API and both frontends. Nest's built-in
 * ValidationPipe is deliberately not used: it requires class-validator, and
 * carrying two validation libraries would mean two sources of truth for the
 * same contract.
 *
 * Applied per-route with the schema for that route:
 *
 *   @UsePipes(new ZodValidationPipe(scriptureContextSchema))
 */
export class ZodValidationPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
