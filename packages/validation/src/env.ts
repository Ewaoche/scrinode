import { z } from 'zod';

/**
 * Environment validation.
 *
 * Scrinode is production-first: a misconfigured environment must fail at
 * boot, loudly, rather than surfacing as a runtime error under load.
 */

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

/**
 * A MongoDB connection string.
 *
 * Accepts both `mongodb://` and `mongodb+srv://`. The value is a secret and
 * must never be logged or committed.
 */
export const mongoUriSchema = z
  .string()
  .min(1, 'MONGODB_URI is required')
  .refine((v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), {
    message: 'Expected a mongodb:// or mongodb+srv:// connection string',
  });

export const databaseNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, 'Database name may contain only letters, numbers, _ and -');

export const portSchema = z.coerce.number().int().min(1).max(65535);

/** Environment required by `@scrinode/api`. */
export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  API_PORT: portSchema.default(4000),
  MONGODB_URI: mongoUriSchema,
  MONGODB_DB: databaseNameSchema,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Validates environment variables, throwing a readable error listing every
 * problem rather than only the first.
 */
export function validateEnv<T extends z.ZodType>(schema: T, source: unknown): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return result.data;
}
