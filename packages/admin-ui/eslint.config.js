import base from '@scrinode/eslint-config';

export default [
  ...base,
  {
    files: ['src/**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
