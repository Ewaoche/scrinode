import { z } from 'zod';

/**
 * Security configuration — AGENTS.md §33.
 *
 * CORS origins are configuration rather than code so the allowed callers
 * differ per environment without a rebuild.
 */

/**
 * Comma-separated list of origins permitted to call the API.
 *
 * A wildcard is rejected outright: the API serves authenticated requests with
 * credentials, and `*` with credentials is both forbidden by browsers and a
 * sign someone meant to disable the check.
 */
export const corsOriginsSchema = z
  .string()
  .default('http://localhost:3000,http://localhost:3001')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .refine((origins) => origins.length > 0, {
    message: 'At least one allowed origin is required',
  })
  .refine((origins) => !origins.includes('*'), {
    message:
      'A wildcard origin is not permitted: the API serves credentialed requests. ' +
      'List each allowed origin explicitly.',
  })
  .refine(
    // Matched rather than parsed with `new URL`: this package has no runtime
    // dependencies and is shared with edge runtimes, so it must not assume
    // Node globals (AGENTS.md §8).
    (origins) => origins.every((origin) => /^https?:\/\/[^/\s]+$/.test(origin)),
    {
      message:
        'Each origin must be an absolute http(s) URL with no path or trailing slash, ' +
        'e.g. https://scrinode.com',
    },
  );

export type CorsOrigins = z.infer<typeof corsOriginsSchema>;
