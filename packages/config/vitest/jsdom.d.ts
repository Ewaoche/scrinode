import type { UserConfig } from 'vitest/config';

/**
 * Vitest configuration for a package rendering React under jsdom, with
 * worker counts capped so concurrent Turborepo tasks cannot oversubscribe
 * the CPU. See `jsdom.js` for the reasoning.
 *
 * `overrides.test` is merged over the defaults; everything else is merged at
 * the top level.
 */
export declare function jsdomConfig(overrides?: UserConfig): UserConfig;
