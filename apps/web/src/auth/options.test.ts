import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthOptions } from './options';

const VALID_SECRET = 'x'.repeat(32);

describe('buildAuthOptions', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
    process.env.MONGODB_DB = 'scrinode_test';
    process.env.NEXTAUTH_SECRET = VALID_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  describe('signing secret', () => {
    it('throws when absent', () => {
      delete process.env.NEXTAUTH_SECRET;
      // No safe fallback exists: a guessed secret means forgeable sessions.
      expect(() => buildAuthOptions()).toThrow(/NEXTAUTH_SECRET must be set/);
    });

    it('throws when too short', () => {
      process.env.NEXTAUTH_SECRET = 'short';
      expect(() => buildAuthOptions()).toThrow(/at least 32 characters/);
    });

    it('explains how to generate one', () => {
      delete process.env.NEXTAUTH_SECRET;
      expect(() => buildAuthOptions()).toThrow(/openssl rand -base64 32/);
    });

    it('never includes the secret in the error', () => {
      process.env.NEXTAUTH_SECRET = 'short-but-identifiable';
      try {
        buildAuthOptions();
        expect.unreachable('should have thrown');
      } catch (error) {
        expect((error as Error).message).not.toContain('short-but-identifiable');
      }
    });
  });

  describe('providers', () => {
    it('registers Google when configured', () => {
      process.env.GOOGLE_CLIENT_ID = 'id';
      process.env.GOOGLE_CLIENT_SECRET = 'secret';

      const ids = buildAuthOptions().providers.map((p) => p.id);
      expect(ids).toContain('google');
    });

    it('registers email when configured', () => {
      process.env.RESEND_API_KEY = 'key';
      process.env.EMAIL_FROM = 'noreply@scrinode.com';

      const ids = buildAuthOptions().providers.map((p) => p.id);
      expect(ids).toContain('email');
    });

    it('registers both when both are configured', () => {
      process.env.GOOGLE_CLIENT_ID = 'id';
      process.env.GOOGLE_CLIENT_SECRET = 'secret';
      process.env.RESEND_API_KEY = 'key';
      process.env.EMAIL_FROM = 'noreply@scrinode.com';

      const ids = buildAuthOptions().providers.map((p) => p.id);
      expect(ids).toEqual(expect.arrayContaining(['google', 'email']));
    });

    it('omits Google when only half its credentials are present', () => {
      process.env.GOOGLE_CLIENT_ID = 'id';

      const ids = buildAuthOptions().providers.map((p) => p.id);
      expect(ids).not.toContain('google');
    });

    it('omits email when only half its credentials are present', () => {
      process.env.RESEND_API_KEY = 'key';

      const ids = buildAuthOptions().providers.map((p) => p.id);
      expect(ids).not.toContain('email');
    });
  });

  describe('session policy', () => {
    it('uses database sessions', () => {
      // Database strategy lets a session be revoked server-side; a JWT
      // cannot be withdrawn before it expires.
      expect(buildAuthOptions().session?.strategy).toBe('database');
    });

    it('expires reader sessions after thirty days', () => {
      expect(buildAuthOptions().session?.maxAge).toBe(30 * 24 * 60 * 60);
    });

    it('routes sign-in to the custom page', () => {
      expect(buildAuthOptions().pages?.signIn).toBe('/signin');
    });
  });
});
