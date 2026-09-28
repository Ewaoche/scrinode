import type { NextConfig } from 'next';

/**
 * The Content Security Policy is set per request in middleware.ts, which can
 * issue a nonce. Headers here are the static ones.
 *
 * Zedek renders model output alongside Scripture and user notes, none of which
 * may execute — so the nonce-based policy matters more here than anywhere
 * else in the product (§33).
 */
const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source rather than built output.
  transpilePackages: ['@scrinode/types', '@scrinode/scripture', '@scrinode/validation', '@scrinode/ui'],

  // Do not advertise the framework to an attacker fingerprinting the stack.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrers may reveal which passage a reader is studying, so send
          // only the origin off-site.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default config;
