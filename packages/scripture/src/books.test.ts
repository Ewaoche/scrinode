import { describe, expect, it } from 'vitest';
import {
  ALL_BOOKS,
  BOOKS,
  DEUTEROCANONICAL_BOOKS,
  USFM_NON_BOOK_CODES,
  canonOf,
  getAnyBook,
  getBook,
  isDeuterocanonical,
  isKnownBookId,
  isValidBookId,
} from './books.js';

describe('BOOKS', () => {
  it('contains the 66 books of the Protestant canon', () => {
    expect(BOOKS).toHaveLength(66);
  });

  it('splits 39 Old Testament and 27 New Testament books', () => {
    expect(BOOKS.filter((b) => b.testament === 'OT')).toHaveLength(39);
    expect(BOOKS.filter((b) => b.testament === 'NT')).toHaveLength(27);
  });

  it('is in canonical order with no gaps', () => {
    BOOKS.forEach((book, index) => {
      expect(book.order).toBe(index + 1);
    });
  });

  it('opens with Genesis and closes with Revelation', () => {
    expect(BOOKS[0]?.id).toBe('GEN');
    expect(BOOKS[65]?.id).toBe('REV');
  });

  it('has unique book ids', () => {
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(66);
  });

  it('gives every book at least one chapter', () => {
    for (const book of BOOKS) {
      expect(book.chapters).toBeGreaterThan(0);
    }
  });

  it('records known chapter counts', () => {
    expect(getBook('PSA')?.chapters).toBe(150);
    expect(getBook('GEN')?.chapters).toBe(50);
    expect(getBook('REV')?.chapters).toBe(22);
    expect(getBook('JUD')?.chapters).toBe(1);
    expect(getBook('OBA')?.chapters).toBe(1);
  });
});

describe('getBook', () => {
  it('finds a book by id', () => {
    expect(getBook('ROM')?.name).toBe('Romans');
  });

  it('is case-insensitive', () => {
    expect(getBook('rom')?.name).toBe('Romans');
  });

  it('returns undefined for an unknown id', () => {
    expect(getBook('XYZ')).toBeUndefined();
  });
});

describe('isValidBookId', () => {
  it('accepts canonical ids', () => {
    expect(isValidBookId('GEN')).toBe(true);
    expect(isValidBookId('1CO')).toBe(true);
  });

  it('rejects unknown ids', () => {
    expect(isValidBookId('XYZ')).toBe(false);
    expect(isValidBookId('')).toBe(false);
  });
});

describe('DEUTEROCANONICAL_BOOKS', () => {
  it('covers the books the public-domain texts actually carry', () => {
    // 20 codes appear across the 13 deuterocanonical editions on eBible.org.
    expect(DEUTEROCANONICAL_BOOKS).toHaveLength(20);
  });

  it('does not overlap the Protestant canon', () => {
    const protestant = new Set(BOOKS.map((b) => b.id));
    for (const book of DEUTEROCANONICAL_BOOKS) {
      expect(protestant.has(book.id), book.id).toBe(false);
    }
  });

  it('continues the order sequence without gaps', () => {
    DEUTEROCANONICAL_BOOKS.forEach((book, index) => {
      expect(book.order).toBe(67 + index);
    });
  });

  it('gives every book at least one chapter', () => {
    for (const book of DEUTEROCANONICAL_BOOKS) {
      expect(book.chapters, book.id).toBeGreaterThan(0);
    }
  });

  it('records chapter counts read from the USFM sources', () => {
    expect(getAnyBook('SIR')?.chapters).toBe(51);
    expect(getAnyBook('1MA')?.chapters).toBe(16);
    expect(getAnyBook('TOB')?.chapters).toBe(14);
    // Single-chapter additions to Daniel and Esther.
    expect(getAnyBook('SUS')?.chapters).toBe(1);
    expect(getAnyBook('BEL')?.chapters).toBe(1);
  });
});

describe('ALL_BOOKS', () => {
  it('is both canons with unique ids', () => {
    expect(ALL_BOOKS).toHaveLength(86);
    expect(new Set(ALL_BOOKS.map((b) => b.id)).size).toBe(86);
  });
});

describe('canon separation', () => {
  /**
   * The important property: widening the registry must not widen what the
   * 66-book code paths accept. A deuterocanonical reference reaching a
   * Protestant-only surface should fail, not render blank.
   */
  it('keeps getBook restricted to the Protestant canon', () => {
    expect(getBook('TOB')).toBeUndefined();
    expect(getBook('SIR')).toBeUndefined();
    expect(isValidBookId('TOB')).toBe(false);
  });

  it('resolves both canons through getAnyBook', () => {
    expect(getAnyBook('TOB')?.name).toBe('Tobit');
    expect(getAnyBook('ROM')?.name).toBe('Romans');
    expect(isKnownBookId('TOB')).toBe(true);
    expect(isKnownBookId('ROM')).toBe(true);
  });

  it('reports the canon of a book', () => {
    expect(canonOf('ROM')).toBe('protestant');
    expect(canonOf('TOB')).toBe('deuterocanonical');
    expect(canonOf('ZZZ')).toBeUndefined();
  });

  it('is case-insensitive across both canons', () => {
    expect(getAnyBook('tob')?.id).toBe('TOB');
    expect(isDeuterocanonical('sir')).toBe(true);
    expect(isDeuterocanonical('rom')).toBe(false);
  });
});

describe('USFM_NON_BOOK_CODES', () => {
  it('excludes peripheral matter that would become malformed references', () => {
    // These appear as .usfm files in eBible archives alongside Scripture.
    for (const code of ['FRT', 'INT', 'GLO', 'BAK']) {
      expect(USFM_NON_BOOK_CODES.has(code), code).toBe(true);
    }
  });

  it('never excludes a real book', () => {
    for (const book of ALL_BOOKS) {
      expect(USFM_NON_BOOK_CODES.has(book.id), book.id).toBe(false);
    }
  });
});
