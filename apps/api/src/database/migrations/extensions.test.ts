import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the extension list, which is declared in three places.
 *
 * The container's init SQL is the source of truth, but CI and the E2E runner
 * create extensions themselves — neither uses the container image, and
 * `CREATE EXTENSION` needs privileges the application role lacks.
 *
 * A drift here does not fail loudly. The migration that needs the missing
 * extension fails with an error about an unknown type or function, which
 * reads like a bug in the migration rather than a missing extension three
 * files away.
 *
 * PostGIS is deliberately excluded from the test harnesses: nothing under
 * test uses geometry, and installing it would slow every CI run.
 */
describe('extension list stays in step', () => {
  const root = join(__dirname, '../../../../..');

  const initSql = readFileSync(
    join(root, 'infra/postgres/init/001-extensions.sql'),
    'utf8',
  );
  const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  const e2e = readFileSync(join(root, 'apps/e2e/run.mjs'), 'utf8');

  /** Extensions the init SQL creates, in declaration order. */
  const declared = [...initSql.matchAll(/CREATE EXTENSION IF NOT EXISTS (\w+)/g)].map(
    (m) => m[1]!,
  );

  /** Needed by tests. PostGIS is not: no test touches geometry. */
  const required = declared.filter((name) => name !== 'postgis');

  it('declares the extensions the schema depends on', () => {
    // A guard against the list being emptied or an extension quietly
    // dropped: these four are load-bearing for §14 and §19.
    expect(declared).toContain('vector');
    expect(declared).toContain('pg_trgm');
    expect(declared).toContain('fuzzystrmatch');
    expect(declared).toContain('unaccent');
    expect(declared).toContain('btree_gin');
  });

  for (const name of ['vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent', 'btree_gin']) {
    it(`creates ${name} in CI`, () => {
      expect(ci).toContain(`CREATE EXTENSION IF NOT EXISTS ${name}`);
    });

    it(`creates ${name} in the E2E runner`, () => {
      expect(e2e).toContain(`CREATE EXTENSION IF NOT EXISTS ${name}`);
    });
  }

  it('covers every required extension in CI', () => {
    // Catches an extension added to init SQL and forgotten elsewhere, which
    // the per-name cases above cannot.
    const missing = required.filter(
      (name) => !ci.includes(`CREATE EXTENSION IF NOT EXISTS ${name}`),
    );

    expect(missing, `Missing from .github/workflows/ci.yml: ${missing.join(', ')}`).toEqual([]);
  });

  it('covers every required extension in the E2E runner', () => {
    const missing = required.filter(
      (name) => !e2e.includes(`CREATE EXTENSION IF NOT EXISTS ${name}`),
    );

    expect(missing, `Missing from apps/e2e/run.mjs: ${missing.join(', ')}`).toEqual([]);
  });

  it('keeps PostGIS out of the test harnesses', () => {
    // It is installed in the container for Phase 2, but nothing under test
    // uses geometry and building it would slow every CI run.
    expect(ci).not.toContain('CREATE EXTENSION IF NOT EXISTS postgis');
    expect(e2e).not.toContain('CREATE EXTENSION IF NOT EXISTS postgis');
  });
});
