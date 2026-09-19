/**
 * Package boundary enforcement — AGENTS.md §8.
 *
 * These are rules, not conventions. A violating import fails the build.
 *
 * ESLint runs per package, so boundaries are expressed as forbidden imports
 * by package name rather than by file-system layout: a rule keyed on repo
 * paths never matches when lint runs from inside a package.
 */

/** Rules that apply to every package. */
const UNIVERSAL_RESTRICTIONS = [
  {
    // AGENTS.md §17 — product logic must not couple to one LLM vendor.
    group: ['openai', '@anthropic-ai/*', '@google/generative-ai', '@mistralai/*', 'cohere-ai'],
    message: 'Vendor AI SDKs belong in @scrinode/ai behind the AIProvider interface (AGENTS.md §17).',
  },
];

/**
 * Restrictions for one package.
 *
 * @param {object} options
 * @param {string[]} [options.forbid] Package names this package must not import.
 * @param {string} [options.reason] Why, surfaced in the lint error.
 * @param {boolean} [options.allowAi] Set on @scrinode/ai, which owns the adapters.
 */
export function boundaries({ forbid = [], reason = '', allowAi = false } = {}) {
  const paths = forbid.map((name) => ({
    name,
    message: reason || `${name} must not be imported here (AGENTS.md §8).`,
  }));

  const patterns = [
    ...(allowAi ? [] : UNIVERSAL_RESTRICTIONS),
    {
      // A relative import reaching into another package's source defeats the
      // scoped names the boundary rules are written against. Deep relative
      // paths within a package are untouched.
      group: ['**/packages/*/src/**', '**/apps/*/src/**'],
      message: 'Import across packages by name (@scrinode/…), never by relative path.',
    },
  ];

  return {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths, patterns }],
    },
  };
}

export default boundaries;
