import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: ['@scrinode/web', '@scrinode/scripture'],
    reason: 'Admin components must not depend on reader concerns (AGENTS.md §8).',
  }),
  {
    files: ['src/**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
