import boundaries from 'eslint-plugin-boundaries';

/**
 * Package boundary enforcement — AGENTS.md §8.
 *
 * These are rules, not conventions. A violating import fails the build.
 *
 * The critical one is that @scrinode/web may never import @scrinode/admin-ui:
 * admin code must never ship in the public bundle.
 */
export default [
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app-web', pattern: 'apps/web/**' },
        { type: 'app-backoffice', pattern: 'apps/backoffice/**' },
        { type: 'app-api', pattern: 'apps/api/**' },
        { type: 'pkg-types', pattern: 'packages/types/**' },
        { type: 'pkg-validation', pattern: 'packages/validation/**' },
        { type: 'pkg-scripture', pattern: 'packages/scripture/**' },
        { type: 'pkg-ui', pattern: 'packages/ui/**' },
        { type: 'pkg-admin-ui', pattern: 'packages/admin-ui/**' },
        { type: 'pkg-ai', pattern: 'packages/ai/**' },
        { type: 'pkg-config', pattern: 'packages/config/**' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              // Admin code never ships in the public bundle.
              from: ['app-web'],
              disallow: ['pkg-admin-ui', 'app-backoffice'],
              message: 'Admin code must never be imported by the public reader (AGENTS.md §8).',
            },
            {
              // Apps are independent deploys.
              from: ['app-backoffice'],
              disallow: ['app-web'],
              message: 'Apps are independent deploys and must not import each other.',
            },
            {
              // Shared by everything, including edge runtimes.
              from: ['pkg-types'],
              disallow: [
                'pkg-validation',
                'pkg-scripture',
                'pkg-ui',
                'pkg-admin-ui',
                'pkg-ai',
                'app-web',
                'app-backoffice',
                'app-api',
              ],
              message: '@scrinode/types must have no runtime dependencies (AGENTS.md §8).',
            },
          ],
        },
      ],

      // Imports use the package name, never a relative path across a boundary.
      'boundaries/no-private': ['error', { allowUncles: false }],
    },
  },
  {
    // AGENTS.md §17 — no vendor AI SDK outside @scrinode/ai.
    files: ['apps/**/*.{ts,tsx}', 'packages/!(ai)/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'openai',
              message: 'Vendor AI SDKs belong in @scrinode/ai behind AIProvider (AGENTS.md §17).',
            },
            {
              name: '@anthropic-ai/sdk',
              message: 'Vendor AI SDKs belong in @scrinode/ai behind AIProvider (AGENTS.md §17).',
            },
            {
              name: '@google/generative-ai',
              message: 'Vendor AI SDKs belong in @scrinode/ai behind AIProvider (AGENTS.md §17).',
            },
          ],
        },
      ],
    },
  },
];
