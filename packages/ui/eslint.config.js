import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: ['@scrinode/admin-ui', '@scrinode/backoffice', '@scrinode/api'],
    reason:
      'Shared primitives must not depend on an application or on admin concerns (AGENTS.md §8).',
  }),
  {
    files: ['src/**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
