import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: ['@scrinode/web', '@scrinode/scripture'],
    reason:
      'The backoffice is an independent deploy and must not import the reader app. ' +
      'Scripture reading concerns belong to @scrinode/web (AGENTS.md §8, §51.2).',
  }),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
