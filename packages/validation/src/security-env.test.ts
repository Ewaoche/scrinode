import { describe, expect, it } from 'vitest';
import { corsOriginsSchema } from './security-env.js';

const parse = (value: string) => corsOriginsSchema.safeParse(value);

describe('corsOriginsSchema', () => {
  it('parses a single origin', () => {
    expect(parse('https://scrinode.com').data).toEqual(['https://scrinode.com']);
  });

  it('parses several origins', () => {
    expect(parse('https://scrinode.com,https://admin.scrinode.com').data).toEqual([
      'https://scrinode.com',
      'https://admin.scrinode.com',
    ]);
  });

  it('trims surrounding whitespace', () => {
    expect(parse(' https://scrinode.com , https://admin.scrinode.com ').data).toEqual([
      'https://scrinode.com',
      'https://admin.scrinode.com',
    ]);
  });

  it('defaults to the local apps', () => {
    expect(corsOriginsSchema.parse(undefined)).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  describe('rejects', () => {
    it('a wildcard', () => {
      // The API serves credentialed requests; '*' is forbidden by browsers
      // with credentials and signals that someone meant to disable the check.
      const result = parse('*');
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/wildcard/i);
    });

    it('a wildcard hidden among valid origins', () => {
      expect(parse('https://scrinode.com,*').success).toBe(false);
    });

    it('an empty value', () => {
      expect(parse('').success).toBe(false);
    });

    it('a bare hostname with no scheme', () => {
      expect(parse('scrinode.com').success).toBe(false);
    });

    it('an origin with a path', () => {
      // An origin is scheme, host and port only. A path silently fails to
      // match at runtime, which is worse than failing at boot.
      expect(parse('https://scrinode.com/app').success).toBe(false);
    });

    it('an origin with a trailing slash', () => {
      expect(parse('https://scrinode.com/').success).toBe(false);
    });

    it('a non-http scheme', () => {
      expect(parse('ftp://scrinode.com').success).toBe(false);
      expect(parse('javascript:alert(1)').success).toBe(false);
    });

    it('a null origin', () => {
      // 'null' is sent by sandboxed iframes and data: documents.
      expect(parse('null').success).toBe(false);
    });
  });
});
