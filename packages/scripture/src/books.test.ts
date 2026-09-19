import { describe, expect, it } from 'vitest';
import { BOOKS, getBook, isValidBookId } from './books.js';

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
