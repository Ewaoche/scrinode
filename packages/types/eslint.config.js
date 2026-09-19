import base from '@scrinode/eslint-config';
import { boundaries } from '@scrinode/eslint-config/boundaries';

export default [
  ...base,
  boundaries({
    forbid: [
      '@scrinode/validation',
      '@scrinode/scripture',
      '@scrinode/ui',
      '@scrinode/admin-ui',
      '@scrinode/ai',
    ],
    reason:
      '@scrinode/types must have no runtime dependencies: it is imported by every ' +
      'app and package, including edge runtimes (AGENTS.md §8).',
  }),
];
