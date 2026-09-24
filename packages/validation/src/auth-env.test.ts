import { describe, expect, it } from 'vitest';
import { authSecretSchema, webAuthEnvSchema } from './auth-env.js';
import { validateEnv } from './env.js';

const base = {
  NODE_ENV: 'test',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXTAUTH_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgres://localhost:5432/scrinode_test',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};

describe('authSecretSchema', () => {
  it('accepts a 32-character secret', () => {
    expect(authSecretSchema.safeParse('x'.repeat(32)).success).toBe(true);
  });

  it('rejects a short secret', () => {
    // A weak signing secret is a forgeable session.
    expect(authSecretSchema.safeParse('short').success).toBe(false);
  });

  it('rejects an empty secret', () => {
    expect(authSecretSchema.safeParse('').success).toBe(false);
  });

  it('explains how to generate one', () => {
    const result = authSecretSchema.safeParse('short');
    expect(result.error?.issues[0]?.message).toContain('openssl rand');
  });
});

describe('webAuthEnvSchema', () => {
  it('accepts a Google-only configuration', () => {
    expect(validateEnv(webAuthEnvSchema, base).GOOGLE_CLIENT_ID).toBe('id');
  });

  it('accepts an email-only configuration', () => {
    const { GOOGLE_CLIENT_ID: _a, GOOGLE_CLIENT_SECRET: _b, ...rest } = base;
    const env = validateEnv(webAuthEnvSchema, {
      ...rest,
      RESEND_API_KEY: 'key',
      EMAIL_FROM: 'noreply@scrinode.com',
    });

    expect(env.EMAIL_FROM).toBe('noreply@scrinode.com');
  });

  it('accepts both providers together', () => {
    const env = validateEnv(webAuthEnvSchema, {
      ...base,
      RESEND_API_KEY: 'key',
      EMAIL_FROM: 'noreply@scrinode.com',
    });

    expect(env.GOOGLE_CLIENT_ID).toBe('id');
    expect(env.RESEND_API_KEY).toBe('key');
  });

  describe('rejects', () => {
    it('a configuration with no provider at all', () => {
      const { GOOGLE_CLIENT_ID: _a, GOOGLE_CLIENT_SECRET: _b, ...rest } = base;
      // Sign-in would be impossible; better to fail at boot.
      expect(() => validateEnv(webAuthEnvSchema, rest)).toThrow(/At least one sign-in provider/);
    });

    it('a Google client id without its secret', () => {
      const { GOOGLE_CLIENT_SECRET: _omitted, ...rest } = base;
      expect(() => validateEnv(webAuthEnvSchema, rest)).toThrow(/must be set together/);
    });

    it('a Google secret without its client id', () => {
      const { GOOGLE_CLIENT_ID: _omitted, ...rest } = base;
      expect(() => validateEnv(webAuthEnvSchema, rest)).toThrow(/must be set together/);
    });

    it('a Resend key without a sender address', () => {
      expect(() => validateEnv(webAuthEnvSchema, { ...base, RESEND_API_KEY: 'key' })).toThrow(
        /must be set together/,
      );
    });

    it('a weak secret', () => {
      expect(() => validateEnv(webAuthEnvSchema, { ...base, NEXTAUTH_SECRET: 'weak' })).toThrow(
        /at least 32 characters/,
      );
    });

    it('a relative NEXTAUTH_URL', () => {
      expect(() => validateEnv(webAuthEnvSchema, { ...base, NEXTAUTH_URL: '/api/auth' })).toThrow(
        /absolute URL/,
      );
    });

    it('an invalid sender address', () => {
      expect(() =>
        validateEnv(webAuthEnvSchema, { ...base, RESEND_API_KEY: 'key', EMAIL_FROM: 'not-an-email' }),
      ).toThrow();
    });
  });

  it('does not leak the secret into error messages', () => {
    try {
      validateEnv(webAuthEnvSchema, { ...base, NEXTAUTH_SECRET: 'supersecretvalue' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('supersecretvalue');
    }
  });
});
