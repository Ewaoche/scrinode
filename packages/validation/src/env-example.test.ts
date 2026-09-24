import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards .env.example against drift.
 *
 * A variable read by the code but missing from .env.example is an
 * undocumented deployment requirement — the kind that surfaces as a
 * production outage rather than a build failure, because most reads have a
 * fallback that is silently wrong outside development.
 *
 * This test walks the repository rather than a fixture, so it keeps working
 * as apps are added.
 */
const repoRoot = join(import.meta.dirname, '..', '..', '..');

/** Variables supplied by the platform or tooling, not by .env.example. */
const PROVIDED_EXTERNALLY = new Set([
  // Set by Next.js, Nest and the host; documented but never required in a
  // local file.
  'NODE_ENV',
  // Vitest and CI runners.
  'CI',
  'VITEST',
  // Set by the operating system. The ingestion ledger records which machine
  // ran a stage, so a shared ledger stays attributable. Documenting these in
  // .env.example would imply they are configuration, which they are not.
  'COMPUTERNAME',
  'HOSTNAME',
]);

function documentedVariables(): Set<string> {
  const contents = readFileSync(join(repoRoot, '.env.example'), 'utf8');
  const names = contents.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm);
  return new Set([...names].map((match) => match[1]!));
}

function usedVariables(): Set<string> {
  // git grep stays inside tracked files, so node_modules and build output
  // never pollute the result.
  const output = execSync(
    'git grep -hoE "process\\.env\\.[A-Z_][A-Z0-9_]*" -- "apps/**/*.ts" "apps/**/*.tsx" "packages/**/*.ts"',
    { cwd: repoRoot, encoding: 'utf8' },
  );

  const names = output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.replace('process.env.', '').trim());

  return new Set(names.filter((name) => !PROVIDED_EXTERNALLY.has(name)));
}

describe('.env.example', () => {
  it('documents every environment variable the code reads', () => {
    const documented = documentedVariables();
    const undocumented = [...usedVariables()].filter((name) => !documented.has(name)).sort();

    expect(undocumented, `Undocumented variables: ${undocumented.join(', ')}`).toEqual([]);
  });

  it('documents every variable the API schema requires', () => {
    const documented = documentedVariables();

    for (const name of ['DATABASE_URL', 'DATABASE_SSL', 'DATABASE_POOL_MAX', 'API_PORT']) {
      expect(documented.has(name), `${name} missing from .env.example`).toBe(true);
    }
  });

  it('documents every variable the web auth schema requires', () => {
    const documented = documentedVariables();

    for (const name of [
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'EMAIL_FROM',
      'RESEND_API_KEY',
    ]) {
      expect(documented.has(name), `${name} missing from .env.example`).toBe(true);
    }
  });

  it('holds no real secret values', () => {
    const contents = readFileSync(join(repoRoot, '.env.example'), 'utf8');

    // Secrets must be empty placeholders. A committed credential is a leaked
    // credential.
    for (const name of ['NEXTAUTH_SECRET', 'GOOGLE_CLIENT_SECRET', 'RESEND_API_KEY']) {
      const match = new RegExp(`^${name}="([^"]*)"`, 'm').exec(contents);
      expect(match?.[1], `${name} must be an empty placeholder`).toBe('');
    }
  });
});
