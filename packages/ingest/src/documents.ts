import type { BookId, Canon, CanonicalVerseId, TranslationCode } from '@scrinode/types';

/**
 * Row shapes for Scripture text.
 *
 * Verse-level granularity, which follows from decisions already made
 * elsewhere in Scrinode rather than from storage preference:
 *
 * - `CanonicalVerseId` is already the database identity (AGENTS.md §10)
 * - cross-references target verses, not chapters
 * - retrieval needs verse-level chunks for Zedek (§20)
 * - the Verse Inspector operates on a single verse
 *
 * Chapter rows would have fought all four.
 *
 * The cost is roughly a million rows across 34 translations — unremarkable
 * for Postgres provided the indexes match the access patterns, which is what
 * `VERSE_INDEXES` is for.
 */

/** Table names. Kept here so nothing hard-codes a string. */
export const TABLES = {
  verses: 'translation_texts',
  translations: 'translations',
  sources: 'sources',
} as const;

/**
 * Column names for `VerseDocument` fields.
 *
 * The interface is camelCase because it is TypeScript; the table is
 * snake_case because it is Postgres. Declared once so the mapping cannot
 * drift between writer and reader (AGENTS.md §42).
 */
export const VERSE_COLUMNS = {
  _id: 'id',
  translation: 'translation',
  bookId: 'book_id',
  canon: 'canon',
  chapter: 'chapter',
  verse: 'verse',
  verseEnd: 'verse_end',
  suffix: 'suffix',
  ref: 'reference_id',
  text: 'text',
  ordinal: 'ordinal',
  release: 'release',
} as const;

/**
 * One verse in one translation.
 *
 * `_id` is deterministic: `BSB:ROM.8.28`, and is the table's primary key.
 * Re-importing the same release is therefore idempotent, and a failed import
 * can be re-run without producing duplicates — which matters because these
 * imports are large enough to fail partway.
 */
export interface VerseDocument {
  readonly _id: string;
  readonly translation: TranslationCode;
  readonly bookId: BookId;
  readonly canon: Canon;
  readonly chapter: number;
  readonly verse: number;
  /**
   * Last verse of a merged range, where an edition merged verses.
   * Absent for the ordinary single-verse case.
   */
  readonly verseEnd?: number;
  /**
   * Letter suffix where an edition subdivides a verse, e.g. `a` in Brenton's
   * Genesis 31:50a. Absent for ordinary verses.
   */
  readonly suffix?: string;
  /** Canonical reference without the translation, e.g. `ROM.8.28`. */
  readonly ref: CanonicalVerseId;
  readonly text: string;
  /**
   * Position within the whole Bible, for ordered reads and range scans
   * across book boundaries without a join.
   */
  readonly ordinal: number;
  /** Release this text came from, tying every verse back to a manifest. */
  readonly release: string;
}

/** Registry of what is loaded, one document per translation release. */
export interface TranslationDocument {
  readonly _id: string;
  readonly code: TranslationCode;
  readonly name: string;
  readonly release: string;
  readonly canon: readonly Canon[];
  readonly books: readonly BookId[];
  readonly bookCount: number;
  readonly chapterCount: number;
  readonly verseCount: number;
  readonly licenceName: string;
  readonly licenceUrl: string;
  readonly rightsHolder: string;
  readonly sourceUrl: string;
  readonly archiveSha256: string;
  readonly importedAt: Date;
  /** Whether the reader may offer this translation. */
  readonly available: boolean;
}

/**
 * Build the deterministic `_id` for a verse document.
 *
 * `suffix` carries the letter of a subdivided verse. Brenton's Genesis has
 * both 31:50 and 31:50a, so omitting it would collapse two distinct verses
 * into one and lose text.
 */
export function verseDocumentId(
  translation: string,
  bookId: string,
  chapter: number,
  verse: number,
  suffix?: string,
): string {
  const ref = canonicalRef(bookId, chapter, verse, suffix);
  return `${translation.toUpperCase()}:${ref}`;
}

/** Build the translation-independent canonical reference. */
export function canonicalRef(
  bookId: string,
  chapter: number,
  verse: number,
  suffix?: string,
): CanonicalVerseId {
  return `${bookId.toUpperCase()}.${chapter}.${verse}${suffix ?? ''}` as CanonicalVerseId;
}

/**
 * A sortable position for a verse.
 *
 * `order` is the book's canonical position, so the encoding keeps books,
 * chapters and verses in reading order under a plain numeric sort. The
 * multipliers leave room for 1,000 chapters and 1,000 verses, comfortably
 * above Psalm 119's 176 verses and Psalms' 150 chapters.
 */
export function verseOrdinal(bookOrder: number, chapter: number, verse: number): number {
  return bookOrder * 1_000_000 + chapter * 1_000 + verse;
}

/**
 * Indexes the verse table needs.
 *
 * Declared as data so the migration that creates them and the tests that
 * assert them read from one definition (AGENTS.md §42). The migration owns
 * the DDL; this records what that DDL must cover, in column terms.
 */
export const VERSE_INDEXES = [
  {
    // The reader's primary access pattern: one chapter in one translation.
    name: 'translation_texts_chapter_idx',
    columns: ['translation', 'book_id', 'chapter', 'verse'],
  },
  {
    // Translation comparison: the same verse across every translation.
    // Served by the unique constraint on (reference_id, translation).
    name: 'translation_texts_reference_translation',
    columns: ['reference_id', 'translation'],
  },
  {
    // Ordered reads and ranges crossing book boundaries.
    name: 'translation_texts_ordinal_idx',
    columns: ['translation', 'ordinal'],
  },
  {
    // Removing or replacing one release without touching the rest.
    name: 'translation_texts_release_idx',
    columns: ['translation', 'release'],
  },
] as const;
