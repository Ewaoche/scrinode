import type { BibleReference, BookId, CanonicalVerseId } from '@scrinode/types';
import { getBook, isValidBookId } from './books.js';

/**
 * Canonical reference parsing and formatting — AGENTS.md §10.
 *
 * This is the single implementation. AGENTS.md §42 forbids duplicating
 * reference parsing anywhere else in the codebase.
 *
 * Canonical form is `BOOK.CHAPTER.VERSE` (`ROM.8.28`). Human-readable labels
 * such as `"Romans 8:28"` are presentation values and are never identity.
 */

export class InvalidReferenceError extends Error {
  constructor(input: string, reason: string) {
    super(`Invalid reference "${input}": ${reason}`);
    this.name = 'InvalidReferenceError';
  }
}

/** `ROM.8.28` or `ROM.8.28-30` */
const CANONICAL_PATTERN = /^([A-Z0-9]{3})\.(\d+)\.(\d+)(?:-(\d+))?$/;

/**
 * Parses a canonical reference string.
 *
 * @throws {InvalidReferenceError} if malformed, unknown book, or out of range.
 */
export function parseCanonical(input: string): BibleReference {
  const match = CANONICAL_PATTERN.exec(input.trim().toUpperCase());

  if (!match) {
    throw new InvalidReferenceError(input, 'expected BOOK.CHAPTER.VERSE');
  }

  const [, rawBook, rawChapter, rawStart, rawEnd] = match;

  if (!rawBook || !rawChapter || !rawStart) {
    throw new InvalidReferenceError(input, 'expected BOOK.CHAPTER.VERSE');
  }

  if (!isValidBookId(rawBook)) {
    throw new InvalidReferenceError(input, `unknown book "${rawBook}"`);
  }

  const bookId = rawBook as BookId;
  const chapter = Number(rawChapter);
  const verseStart = Number(rawStart);

  const book = getBook(bookId);
  if (book && chapter > book.chapters) {
    throw new InvalidReferenceError(
      input,
      `${book.name} has ${book.chapters} chapters, got ${chapter}`,
    );
  }

  if (chapter < 1) {
    throw new InvalidReferenceError(input, 'chapter must be 1 or greater');
  }

  if (verseStart < 1) {
    throw new InvalidReferenceError(input, 'verse must be 1 or greater');
  }

  if (rawEnd === undefined) {
    return { bookId, chapter, verseStart };
  }

  const verseEnd = Number(rawEnd);

  if (verseEnd < verseStart) {
    throw new InvalidReferenceError(input, `range end ${verseEnd} precedes start ${verseStart}`);
  }

  if (verseEnd === verseStart) {
    return { bookId, chapter, verseStart };
  }

  return { bookId, chapter, verseStart, verseEnd };
}

/** Parses a canonical reference, returning undefined instead of throwing. */
export function tryParseCanonical(input: string): BibleReference | undefined {
  try {
    return parseCanonical(input);
  } catch {
    return undefined;
  }
}

/** Formats a reference in canonical form: `ROM.8.28` or `ROM.8.28-30`. */
export function formatCanonical(reference: BibleReference): string {
  const base = `${reference.bookId}.${reference.chapter}.${reference.verseStart}`;
  return reference.verseEnd === undefined ? base : `${base}-${reference.verseEnd}`;
}

/**
 * The canonical identifier of a reference's first verse.
 *
 * A range has no single identity: `ROM.8.28-30` is three verse entities. Use
 * this when you need the database identity of the starting verse.
 */
export function toCanonicalVerseId(reference: BibleReference): CanonicalVerseId {
  return `${reference.bookId}.${reference.chapter}.${reference.verseStart}` as CanonicalVerseId;
}

/** Every canonical verse id covered by a reference, in order. */
export function expandToVerseIds(reference: BibleReference): CanonicalVerseId[] {
  const end = reference.verseEnd ?? reference.verseStart;
  const ids: CanonicalVerseId[] = [];

  for (let verse = reference.verseStart; verse <= end; verse += 1) {
    ids.push(`${reference.bookId}.${reference.chapter}.${verse}` as CanonicalVerseId);
  }

  return ids;
}

/**
 * Formats a reference for display: `Romans 8:28`, `Romans 8:28-30`.
 *
 * Presentation only. Never use the result as identity (AGENTS.md §10).
 */
export function formatDisplay(reference: BibleReference): string {
  const book = getBook(reference.bookId);
  const name = book?.name ?? reference.bookId;
  const base = `${name} ${reference.chapter}:${reference.verseStart}`;
  return reference.verseEnd === undefined ? base : `${base}-${reference.verseEnd}`;
}

/** True when two references denote the same book, chapter and verse range. */
export function referencesEqual(a: BibleReference, b: BibleReference): boolean {
  return (
    a.bookId === b.bookId &&
    a.chapter === b.chapter &&
    a.verseStart === b.verseStart &&
    (a.verseEnd ?? a.verseStart) === (b.verseEnd ?? b.verseStart)
  );
}

/** Number of verses a reference covers. */
export function verseCount(reference: BibleReference): number {
  return (reference.verseEnd ?? reference.verseStart) - reference.verseStart + 1;
}
