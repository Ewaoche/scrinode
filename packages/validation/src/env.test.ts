import { describe, expect, it } from 'vitest';
import { apiEnvSchema, mongoUriSchema, validateEnv } from './env.js';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/',
  MONGODB_DB: 'scrinode_test',
};

describe('mongoUriSchema', () => {
  it('accepts a standard connection string', () => {
    expect(mongoUriSchema.safeParse('mongodb://localhost:27017').success).toBe(true);
  });

  it('accepts an SRV connection string', () => {
    expect(mongoUriSchema.safeParse('mongodb+srv://u:p@c.mongodb.net/').success).toBe(true);
  });

  it('rejects a non-mongo URI', () => {
    expect(mongoUriSchema.safeParse('postgres://localhost').success).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(mongoUriSchema.safeParse('').success).toBe(false);
  });
});

describe('apiEnvSchema', () => {
  it('accepts a valid environment', () => {
    const parsed = validateEnv(apiEnvSchema, validEnv);
    expect(parsed.MONGODB_DB).toBe('scrinode_test');
    expect(parsed.API_PORT).toBe(4000);
  });

  it('coerces a numeric port from a string', () => {
    const parsed = validateEnv(apiEnvSchema, { ...validEnv, API_PORT: '8080' });
    expect(parsed.API_PORT).toBe(8080);
  });

  it('defaults the port when absent', () => {
    const { API_PORT: _omitted, ...withoutPort } = validEnv;
    expect(validateEnv(apiEnvSchema, withoutPort).API_PORT).toBe(4000);
  });

  it('rejects a database name with illegal characters', () => {
    expect(apiEnvSchema.safeParse({ ...validEnv, MONGODB_DB: 'bad name!' }).success).toBe(false);
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
      expect(message).toContain('MONGODB_URI');
      expect(message).toContain('MONGODB_DB');
    }
  });

  it('does not leak secret values into the error message', () => {
    try {
      validateEnv(apiEnvSchema, { ...validEnv, MONGODB_URI: 'postgres://supersecret' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('supersecret');
    }
  });
});
