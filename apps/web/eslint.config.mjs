import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: ['@scrinode/admin-ui', '@scrinode/backoffice'],
    reason:
      'Admin code must never ship in the public reader bundle (AGENTS.md §8). ' +
      'The backoffice is a separate application and a separate security domain.',
  }),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
