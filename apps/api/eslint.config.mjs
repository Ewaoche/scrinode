import base from '@scrinode/eslint-config';

export default [
  ...base,
  {
    files: ['src/**/*.ts'],
    rules: {
      // NestJS decorators read constructor parameter types at runtime via
      // emitDecoratorMetadata, which requires value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
