import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const metadata = { type: 'body' } as const;

describe('ZodValidationPipe', () => {
  const schema = z.object({
    reference: z.string().min(1),
    limit: z.coerce.number().int().positive().optional(),
  });

  const pipe = new ZodValidationPipe(schema);

  it('returns parsed data when valid', () => {
    expect(pipe.transform({ reference: 'ROM.8.28' }, metadata)).toEqual({
      reference: 'ROM.8.28',
    });
  });

  it('applies schema coercion', () => {
    expect(pipe.transform({ reference: 'ROM.8.28', limit: '5' }, metadata)).toEqual({
      reference: 'ROM.8.28',
      limit: 5,
    });
  });

  it('throws BadRequestException when invalid', () => {
    expect(() => pipe.transform({ reference: '' }, metadata)).toThrow(BadRequestException);
  });

  it('reports the failing field path', () => {
    try {
      pipe.transform({ reference: '' }, metadata);
      expect.unreachable('should have thrown');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        issues: { path: string }[];
      };
      expect(response.issues[0]?.path).toBe('reference');
    }
  });

  it('reports every issue, not only the first', () => {
    try {
      pipe.transform({ reference: '', limit: -1 }, metadata);
      expect.unreachable('should have thrown');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        issues: unknown[];
      };
      expect(response.issues.length).toBeGreaterThan(1);
    }
  });

  it('rejects a null payload', () => {
    expect(() => pipe.transform(null, metadata)).toThrow(BadRequestException);
  });
});
