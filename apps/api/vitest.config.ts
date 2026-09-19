import { defineConfig } from 'vitest/config';

/**
 * NestJS relies on `emitDecoratorMetadata` for dependency injection, which
 * esbuild does not emit. Vitest is pointed at this app's tsconfig so the
 * TypeScript transform runs instead.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: { tsconfig: './tsconfig.json' },
  },
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
      },
    },
  },
});
