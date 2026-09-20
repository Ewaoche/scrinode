import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Load `.env` into the process environment.
 *
 * The CLI reads its configuration from `process.env`, and nothing was
 * populating it: every stage worked during development only because it was
 * invoked through a wrapper that loaded the file first. Run directly, as the
 * documentation says to, every stage failed on a missing variable.
 *
 * Node 22 has `--env-file`, but a flag every invocation must remember is a
 * worse contract than a file the tool finds itself, and the PowerShell
 * scripts already load `.env` without one.
 *
 * Variables already present win, so an exported shell value, CI secrets and
 * the PowerShell scripts all override the file rather than being overridden
 * by a stale copy of it.
 */

/** Parse `KEY=VALUE` lines, tolerating comments, blanks and quotes. */
export function parseDotEnv(contents: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    // Strip one layer of surrounding quotes, as .env files commonly use.
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }

    values.set(key, value);
  }

  return values;
}

/**
 * Walk up from a starting directory looking for `.env`.
 *
 * The CLI runs from the repository root, from `packages/ingest`, and from
 * wherever a script happens to invoke it. Searching upward means it finds the
 * same file in every case.
 */
export function findDotEnv(startDir: string, maxDepth = 6): string | undefined {
  let current = resolve(startDir);

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    const candidate = join(current, '.env');
    if (existsSync(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}

/**
 * Load `.env` if one is found.
 *
 * Returns the path loaded, or `undefined` when there is none — which is not
 * an error. CI and production supply configuration through the real
 * environment, and a missing file there is correct.
 */
export function loadDotEnv(startDir: string): string | undefined {
  const path = findDotEnv(startDir);
  if (!path) return undefined;

  for (const [key, value] of parseDotEnv(readFileSync(path, 'utf8'))) {
    // An already-set variable wins: never let a stale file override what the
    // caller deliberately exported.
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }

  return path;
}
