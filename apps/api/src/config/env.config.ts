import { apiEnvSchema, validateEnv, type ApiEnv } from '@scrinode/validation';

/**
 * Validates process environment at boot.
 *
 * Scrinode is production-first: a misconfigured deploy must fail to start
 * rather than accept traffic and fail unpredictably under load.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return validateEnv(apiEnvSchema, source);
}

export type { ApiEnv };
