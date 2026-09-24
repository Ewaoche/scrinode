/**
 * @scrinode/validation — shared Zod schemas.
 *
 * AGENTS.md §40: APIs are validation-first. Input is validated at the
 * boundary, never trusted because of where it came from.
 */

export {
  bibleReferenceSchema,
  canonicalReferenceSchema,
  scriptureContextSchema,
  translationCodeSchema,
} from './scripture.js';

export {
  apiEnvSchema,
  booleanFlagSchema,
  databaseNameSchema,
  nodeEnvSchema,
  poolSizeSchema,
  portSchema,
  postgresUriSchema,
  validateEnv,
  type ApiEnv,
} from './env.js';

export { authSecretSchema, webAuthEnvSchema, type WebAuthEnv } from './auth-env.js';

export { corsOriginsSchema, type CorsOrigins } from './security-env.js';
