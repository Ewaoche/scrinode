import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.config';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB: 'scrinode_test',
} as unknown as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('returns a validated environment', () => {
    const env = loadEnv(validEnv);
    expect(env.MONGODB_DB).toBe('scrinode_test');
    expect(env.API_PORT).toBe(4000);
  });

  it('fails when MONGODB_URI is missing', () => {
    const { MONGODB_URI: _omitted, ...rest } = validEnv;
    expect(() => loadEnv(rest as NodeJS.ProcessEnv)).toThrow(/MONGODB_URI/);
  });

  it('fails on a malformed connection string', () => {
    expect(() =>
      loadEnv({ ...validEnv, MONGODB_URI: 'not-a-uri' } as NodeJS.ProcessEnv),
    ).toThrow(/Invalid environment configuration/);
  });

  it('fails on an empty environment rather than starting with defaults', () => {
    // Production-first: a misconfigured deploy must not boot.
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow();
  });
});
