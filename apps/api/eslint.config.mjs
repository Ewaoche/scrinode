import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: ['@scrinode/web', '@scrinode/backoffice', '@scrinode/ui', '@scrinode/admin-ui'],
    reason: 'The API must not import frontend applications or their components (AGENTS.md §8).',
  }),
  {
    files: ['src/**/*.ts'],
    rules: {
      // NestJS decorators read constructor parameter types at runtime via
      // emitDecoratorMetadata, which requires value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // AGENTS.md §8: domain services must not import the MongoDB driver
    // directly. Repositories and the database module are the only places
    // driver types may appear, which keeps the data layer replaceable.
    files: ['src/**/*.ts'],
    ignores: ['src/database/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'mongodb',
              message:
                'Domain services must not import the MongoDB driver. Use a repository ' +
                'in src/database instead (AGENTS.md §8).',
            },
          ],
        },
      ],
    },
  },
];
