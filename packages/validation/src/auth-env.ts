import { z } from 'zod';
import { nodeEnvSchema, postgresUriSchema } from './env.js';

/**
 * Reader authentication environment — AGENTS.md §27.1.
 *
 * This covers reader identity only. Admin identity is a separate security
 * domain with its own collections, sessions and secrets (§27.2), and its
 * configuration arrives with the backoffice in Stage 2.
 */

/**
 * NEXTAUTH_SECRET signs session tokens. A weak secret is a forgeable session,
 * so a minimum length is enforced rather than merely requiring presence.
 *
 * 32 characters matches `openssl rand -base64 32`.
 */
export const authSecretSchema = z
  .string()
  .min(32, 'NEXTAUTH_SECRET must be at least 32 characters; generate with: openssl rand -base64 32');

export const webAuthEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    NEXTAUTH_URL: z.url('NEXTAUTH_URL must be an absolute URL'),
    NEXTAUTH_SECRET: authSecretSchema,
    DATABASE_URL: postgresUriSchema,

    // Google OAuth. Both halves are required together or neither.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Email (magic link) sign-in.
    EMAIL_FROM: z.email().optional(),
    RESEND_API_KEY: z.string().optional(),
  })
  .refine(
    (env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET),
    {
      message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together',
      path: ['GOOGLE_CLIENT_ID'],
    },
  )
  .refine((env) => Boolean(env.RESEND_API_KEY) === Boolean(env.EMAIL_FROM), {
    message: 'RESEND_API_KEY and EMAIL_FROM must be set together',
    path: ['RESEND_API_KEY'],
  })
  .refine(
    (env) => Boolean(env.GOOGLE_CLIENT_ID) || Boolean(env.RESEND_API_KEY),
    {
      message: 'At least one sign-in provider must be configured (Google or email)',
      path: ['NEXTAUTH_SECRET'],
    },
  );

export type WebAuthEnv = z.infer<typeof webAuthEnvSchema>;
