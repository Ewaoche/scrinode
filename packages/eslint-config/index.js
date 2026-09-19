import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Base ESLint configuration shared by every Scrinode package.
 *
 * Package boundary rules live in ./boundaries.js and are applied at the
 * workspace root, where the whole dependency graph is visible.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // AGENTS.md §9 — biblical concepts must not become loosely typed strings.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['dist/**', '.next/**', '.turbo/**', 'coverage/**', 'node_modules/**'],
  },
);
