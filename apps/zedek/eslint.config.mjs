import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: ['@scrinode/admin-ui', '@scrinode/backoffice', '@scrinode/web'],
    reason:
      'Zedek is its own application (AGENTS.md §8). Admin code must never ship ' +
      'in a public bundle, and reaching into apps/web would couple two origins ' +
      'that deploy separately — shared code goes through packages/ (§3.3).',
  }),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
