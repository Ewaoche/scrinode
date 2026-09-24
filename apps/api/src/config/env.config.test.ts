import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.config';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL: 'postgres://localhost:5432/scrinode_test',
} as unknown as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('returns a validated environment', () => {
    const env = loadEnv(validEnv);
    expect(env.DATABASE_URL).toContain('scrinode_test');
    expect(env.API_PORT).toBe(4000);
  });

  it('fails when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omitted, ...rest } = validEnv;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it('fails on a malformed connection string', () => {
    expect(() =>
      loadEnv({ ...validEnv, DATABASE_URL: 'not-a-uri' } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid environment configuration/);
  });

  it('fails on an empty environment rather than starting with defaults', () => {
    // Production-first: a misconfigured deploy must not boot.
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow();
  });
});
