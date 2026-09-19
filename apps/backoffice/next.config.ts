import type { NextConfig } from 'next';

/**
 * Content Security Policy for the backoffice.
 *
 * Stricter than the reader: this app renders imported source data and
 * moderation queues whose content originates outside Scrinode, and it has
 * write access to everything (AGENTS.md §33).
 */
const CSP = [
  "default-src 'self'",
  process.env.NODE_ENV === 'production'
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@scrinode/types', '@scrinode/validation', '@scrinode/admin-ui'],

  /**
   * Internal tooling. These headers are defence in depth, not the boundary —
   * the API enforces every permission server-side (AGENTS.md §51.3), and
   * platform-level access control sits in front of this app.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default config;
