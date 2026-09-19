import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
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
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default config;
