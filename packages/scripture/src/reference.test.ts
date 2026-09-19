import { describe, expect, it } from 'vitest';
import type { BibleReference, BookId } from '@scrinode/types';
import {
  InvalidReferenceError,
  expandToVerseIds,
  formatCanonical,
  formatDisplay,
  parseCanonical,
  referencesEqual,
  toCanonicalVerseId,
  tryParseCanonical,
  verseCount,
} from './reference.js';

const ref = (
  bookId: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number,
): BibleReference =>
  verseEnd === undefined
    ? { bookId: bookId as BookId, chapter, verseStart }
    : { bookId: bookId as BookId, chapter, verseStart, verseEnd };

describe('parseCanonical', () => {
  it('parses a single verse', () => {
    expect(parseCanonical('ROM.8.28')).toEqual(ref('ROM', 8, 28));
  });

  it('parses a verse range', () => {
    expect(parseCanonical('ROM.8.28-30')).toEqual(ref('ROM', 8, 28, 30));
  });

  it('parses numeric book ids', () => {
    expect(parseCanonical('1CO.13.4')).toEqual(ref('1CO', 13, 4));
    expect(parseCanonical('2TI.3.16')).toEqual(ref('2TI', 3, 16));
  });

  it('parses the canon boundaries', () => {
    expect(parseCanonical('GEN.1.1')).toEqual(ref('GEN', 1, 1));
    expect(parseCanonical('REV.22.21')).toEqual(ref('REV', 22, 21));
  });

  it('uppercases lowercase input', () => {
    expect(parseCanonical('rom.8.28')).toEqual(ref('ROM', 8, 28));
  });

  it('trims surrounding whitespace', () => {
    expect(parseCanonical('  ROM.8.28  ')).toEqual(ref('ROM', 8, 28));
  });

  it('normalises a range whose end equals its start', () => {
    const result = parseCanonical('ROM.8.28-28');
    expect(result).toEqual(ref('ROM', 8, 28));
    expect(result.verseEnd).toBeUndefined();
  });

  describe('rejects', () => {
    it('an unknown book', () => {
      expect(() => parseCanonical('XYZ.1.1')).toThrow(InvalidReferenceError);
      expect(() => parseCanonical('XYZ.1.1')).toThrow(/unknown book/);
    });

    it('a human-readable label', () => {
      expect(() => parseCanonical('Romans 8:28')).toThrow(InvalidReferenceError);
    });

    it('a chapter beyond the book', () => {
      // Jude has one chapter.
      expect(() => parseCanonical('JUD.2.1')).toThrow(/has 1 chapters/);
      // Romans has sixteen.
      expect(() => parseCanonical('ROM.17.1')).toThrow(/has 16 chapters/);
    });

    it('chapter zero', () => {
      expect(() => parseCanonical('ROM.0.1')).toThrow(/chapter must be 1 or greater/);
    });

    it('verse zero', () => {
      expect(() => parseCanonical('ROM.8.0')).toThrow(/verse must be 1 or greater/);
    });

    it('a reversed range', () => {
      expect(() => parseCanonical('ROM.8.30-28')).toThrow(/precedes start/);
    });

    it('a missing verse', () => {
      expect(() => parseCanonical('ROM.8')).toThrow(InvalidReferenceError);
    });

    it('an empty string', () => {
      expect(() => parseCanonical('')).toThrow(InvalidReferenceError);
    });
  });
});

describe('tryParseCanonical', () => {
  it('returns a reference when valid', () => {
    expect(tryParseCanonical('JHN.3.16')).toEqual(ref('JHN', 3, 16));
  });

  it('returns undefined instead of throwing', () => {
    expect(tryParseCanonical('not a reference')).toBeUndefined();
  });
});

describe('formatCanonical', () => {
  it('formats a single verse', () => {
    expect(formatCanonical(ref('ROM', 8, 28))).toBe('ROM.8.28');
  });

  it('formats a range', () => {
    expect(formatCanonical(ref('ROM', 8, 28, 30))).toBe('ROM.8.28-30');
  });

  it('round-trips through parseCanonical', () => {
    for (const input of ['GEN.1.1', 'PSA.23.1', 'MAT.5.3', 'JHN.3.16', 'ROM.8.28-30']) {
      expect(formatCanonical(parseCanonical(input))).toBe(input);
    }
  });
});

describe('formatDisplay', () => {
  it('renders a human-readable label', () => {
    expect(formatDisplay(ref('ROM', 8, 28))).toBe('Romans 8:28');
  });

  it('renders a range', () => {
    expect(formatDisplay(ref('ROM', 8, 28, 30))).toBe('Romans 8:28-30');
  });

  it('renders multi-word book names', () => {
    expect(formatDisplay(ref('1CO', 13, 4))).toBe('1 Corinthians 13:4');
    expect(formatDisplay(ref('SNG', 2, 1))).toBe('Song of Solomon 2:1');
  });
});

describe('toCanonicalVerseId', () => {
  it('returns the id of a single verse', () => {
    expect(toCanonicalVerseId(ref('ROM', 8, 28))).toBe('ROM.8.28');
  });

  it("returns the range's first verse", () => {
    expect(toCanonicalVerseId(ref('ROM', 8, 28, 30))).toBe('ROM.8.28');
  });
});

describe('expandToVerseIds', () => {
  it('expands a single verse to one id', () => {
    expect(expandToVerseIds(ref('ROM', 8, 28))).toEqual(['ROM.8.28']);
  });

  it('expands a range inclusively', () => {
    expect(expandToVerseIds(ref('ROM', 8, 28, 30))).toEqual([
      'ROM.8.28',
      'ROM.8.29',
      'ROM.8.30',
    ]);
  });
});

describe('referencesEqual', () => {
  it('matches identical references', () => {
    expect(referencesEqual(ref('ROM', 8, 28), ref('ROM', 8, 28))).toBe(true);
  });

  it('treats an absent end as equal to an end matching the start', () => {
    expect(referencesEqual(ref('ROM', 8, 28), ref('ROM', 8, 28, 28))).toBe(true);
  });

  it('distinguishes different books, chapters and verses', () => {
    expect(referencesEqual(ref('ROM', 8, 28), ref('JHN', 8, 28))).toBe(false);
    expect(referencesEqual(ref('ROM', 8, 28), ref('ROM', 9, 28))).toBe(false);
    expect(referencesEqual(ref('ROM', 8, 28), ref('ROM', 8, 29))).toBe(false);
    expect(referencesEqual(ref('ROM', 8, 28), ref('ROM', 8, 28, 30))).toBe(false);
  });
});

describe('verseCount', () => {
  it('counts a single verse as one', () => {
    expect(verseCount(ref('ROM', 8, 28))).toBe(1);
  });

  it('counts a range inclusively', () => {
    expect(verseCount(ref('ROM', 8, 28, 30))).toBe(3);
  });
});
