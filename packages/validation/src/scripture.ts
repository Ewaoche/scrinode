import { z } from 'zod';

/**
 * Scripture validation schemas.
 *
 * AGENTS.md §40: APIs are validation-first. These schemas are the boundary
 * between untrusted input and domain types.
 */

/** `ROM.8.28` or `ROM.8.28-30`. Shape only — book validity is checked by
 * `@scrinode/scripture`, which owns the canonical registry. */
export const canonicalReferenceSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{3}\.\d+\.\d+(-\d+)?$/i, 'Expected canonical form, e.g. ROM.8.28');

export const bibleReferenceSchema = z
  .object({
    bookId: z.string().length(3),
    chapter: z.number().int().positive(),
    verseStart: z.number().int().positive(),
    verseEnd: z.number().int().positive().optional(),
  })
  .refine((r) => r.verseEnd === undefined || r.verseEnd >= r.verseStart, {
    message: 'verseEnd must not precede verseStart',
    path: ['verseEnd'],
  });

export const translationCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,10}$/, 'Expected a translation code, e.g. WEB');

export const scriptureContextSchema = z.object({
  reference: bibleReferenceSchema,
  translation: translationCodeSchema,
  selection: z
    .object({
      startVerse: z.number().int().positive(),
      endVerse: z.number().int().positive(),
    })
    .optional(),
  selectedText: z.string().optional(),
  selectedTokens: z.array(z.string()).optional(),
  comparisonTranslations: z.array(translationCodeSchema).optional(),
});
