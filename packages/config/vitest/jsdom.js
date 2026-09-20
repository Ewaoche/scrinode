import { cpus } from 'node:os';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration for packages that render React under jsdom.
 *
 * Three packages need this — @scrinode/admin-ui, @scrinode/web and
 * @scrinode/backoffice — and AGENTS.md §42 forbids duplicating it three
 * times where it could drift apart.
 *
 * ## Why worker counts are capped
 *
 * Vitest defaults its fork pool to roughly `cores - 1` workers PER PACKAGE,
 * and Turborepo runs packages concurrently. On an 8-core machine that is up
 * to 21 forks competing for 8 cores, each constructing a jsdom environment,
 * loading React and loading testing-library. Environment setup is the
 * dominant cost: measured at 73% of a run under saturation.
 *
 * When a fork cannot complete its startup handshake within 60 seconds the
 * run fails with "[vitest-pool-runner]: Timeout waiting for worker to
 * respond" — a failure that looks like a broken test but is pure resource
 * starvation. It was observed once on an 8-core developer machine.
 *
 * That 60-second budget is `START_TIMEOUT` inside Vitest and is NOT
 * configurable, so the timeout cannot simply be raised. The only remedy is
 * to stop oversubscribing the CPU.
 *
 * GitHub's standard runners have 2 cores, so CI is considerably more exposed
 * than the machine where this was first seen.
 *
 * The cap is per package. Three packages at 2 workers each is 6 forks, which
 * an 8-core machine absorbs and a 2-core runner serialises safely rather
 * than thrashing. Single-worker runs on small runners are slightly slower in
 * isolation and far more predictable in aggregate — the right trade for a
 * suite that gates deploys.
 */

/** Leave a core for the parent process and for Turborepo's other tasks. */
const maxWorkers = Math.max(1, Math.min(2, cpus().length - 1));

export function jsdomConfig(overrides = {}) {
  const { test: testOverrides = {}, ...rest } = overrides;

  return defineConfig({
    plugins: [react()],
    ...rest,
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./vitest.setup.ts'],
      globals: true,
      // Vitest 5 removed `poolOptions`; `maxWorkers` is top-level now.
      pool: 'forks',
      maxWorkers,
      ...testOverrides,
    },
  });
}
