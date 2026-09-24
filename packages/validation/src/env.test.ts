import { describe, expect, it } from 'vitest';
import { apiEnvSchema, postgresUriSchema, validateEnv } from './env.js';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/scrinode_test',
};

describe('postgresUriSchema', () => {
  it('accepts a postgres:// connection string', () => {
    expect(postgresUriSchema.safeParse('postgres://localhost:5432/db').success).toBe(true);
  });

  it('accepts the postgresql:// spelling, which libpq treats as identical', () => {
    expect(postgresUriSchema.safeParse('postgresql://u:p@host:5432/db').success).toBe(true);
  });

  it('rejects a connection string for another database', () => {
    expect(postgresUriSchema.safeParse('mongodb://localhost:27017').success).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(postgresUriSchema.safeParse('').success).toBe(false);
  });
});

describe('apiEnvSchema', () => {
  it('accepts a valid environment', () => {
    const parsed = validateEnv(apiEnvSchema, validEnv);
    expect(parsed.DATABASE_URL).toContain('scrinode_test');
    expect(parsed.API_PORT).toBe(4000);
  });

  it('defaults TLS to off, which is how the droplet reaches Postgres', () => {
    // App and database share a private compose network there. A managed
    // database reached across a network must set it explicitly.
    expect(validateEnv(apiEnvSchema, validEnv).DATABASE_SSL).toBe(false);
  });

  it('parses DATABASE_SSL as a boolean, not a string', () => {
    // 'false' is truthy as a string; reading it unparsed would silently
    // enable TLS everywhere.
    const parsed = validateEnv(apiEnvSchema, { ...validEnv, DATABASE_SSL: 'true' });
    expect(parsed.DATABASE_SSL).toBe(true);
  });

  it('defaults the pool to a size one small droplet can serve', () => {
    expect(validateEnv(apiEnvSchema, validEnv).DATABASE_POOL_MAX).toBe(10);
  });

  it('rejects a pool larger than Postgres would tolerate', () => {
    expect(apiEnvSchema.safeParse({ ...validEnv, DATABASE_POOL_MAX: '500' }).success).toBe(false);
  });

  it('coerces a numeric port from a string', () => {
    const parsed = validateEnv(apiEnvSchema, { ...validEnv, API_PORT: '8080' });
    expect(parsed.API_PORT).toBe(8080);
  });

  it('defaults the port when absent', () => {
    const { API_PORT: _omitted, ...withoutPort } = validEnv;
    expect(validateEnv(apiEnvSchema, withoutPort).API_PORT).toBe(4000);
  });

  it('rejects an out-of-range port', () => {
    expect(apiEnvSchema.safeParse({ ...validEnv, API_PORT: '70000' }).success).toBe(false);
  });
});

describe('validateEnv', () => {
  it('throws when configuration is invalid', () => {
    expect(() => validateEnv(apiEnvSchema, {})).toThrow(/Invalid environment configuration/);
  });

  it('reports every problem, not only the first', () => {
    try {
      validateEnv(apiEnvSchema, { NODE_ENV: 'test' });
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
    }
  });

  it('does not leak secret values into the error message', () => {
    try {
      validateEnv(apiEnvSchema, { ...validEnv, DATABASE_URL: 'mysql://supersecret' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('supersecret');
    }
  });
});
