import { z } from 'zod';
import { corsOriginsSchema } from './security-env.js';

/**
 * Environment validation.
 *
 * Scrinode is production-first: a misconfigured environment must fail at
 * boot, loudly, rather than surfacing as a runtime error under load.
 */

export const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

/**
 * A PostgreSQL connection string.
 *
 * Accepts both `postgres://` and `postgresql://`, which libpq treats as
 * equivalent. The value is a secret and must never be logged or committed.
 *
 * Deliberately not parsed further here. A connection string carries options
 * whose validity only the driver can judge, and rejecting a string this
 * schema failed to understand would block a legitimate deploy.
 */
export const postgresUriSchema = z
  .string()
  .min(1, 'DATABASE_URL is required')
  .refine((v) => v.startsWith('postgres://') || v.startsWith('postgresql://'), {
    message: 'Expected a postgres:// or postgresql:// connection string',
  });

export const databaseNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, 'Database name may contain only letters, numbers, _ and -');

export const portSchema = z.coerce.number().int().min(1).max(65535);

/**
 * Whether to require TLS to the database.
 *
 * On the droplet the application reaches Postgres over a private compose
 * network and TLS is unnecessary; a managed database reached across a network
 * requires it. Defaulting to `false` matches the deployment we actually have,
 * and the setting is explicit so moving to a managed database is a
 * configuration change rather than a code change.
 */
export const booleanFlagSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

/**
 * Maximum pooled connections.
 *
 * Postgres allocates a backend process per connection, so a pool that is too
 * large exhausts the server rather than improving throughput. The default
 * suits a single API instance on a small droplet; raise it only alongside
 * Postgres's own `max_connections`.
 */
export const poolSizeSchema = z.coerce.number().int().min(1).max(100).default(10);

/** Environment required by `@scrinode/api`. */
export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  API_PORT: portSchema.default(4000),
  DATABASE_URL: postgresUriSchema,
  DATABASE_SSL: booleanFlagSchema,
  DATABASE_POOL_MAX: poolSizeSchema,

  // Origins permitted to call the API. Defaults to the local reader and
  // backoffice so development needs no configuration; every deployed
  // environment must set it explicitly.
  CORS_ORIGINS: corsOriginsSchema,
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
