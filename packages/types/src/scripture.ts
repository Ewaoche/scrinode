/**
 * Canonical Scripture primitives.
 *
 * AGENTS.md §10: the canonical verse is the biblical reference entity, not a
 * specific translation. Translation text is a representation of the verse.
 *
 * AGENTS.md §9: biblical concepts must not become loosely typed strings.
 *   Bad:       const reference = 'Romans 8:28';
 *   Preferred: { bookId: 'ROM', chapter: 8, verseStart: 28 }
 */

/** Three-letter canonical book identifier, e.g. `GEN`, `ROM`, `REV`. */
export type BookId = string & { readonly __brand: 'BookId' };

/** Two-letter translation code, e.g. `WEB`, `KJV`, `ASV`. */
export type TranslationCode = string & { readonly __brand: 'TranslationCode' };

/**
 * Canonical verse identifier in `BOOK.CHAPTER.VERSE` form, e.g. `ROM.8.28`.
 *
 * This is the database identity. Human-readable labels such as `"Romans 8:28"`
 * are presentation-level values and must never be used as identity.
 */
export type CanonicalVerseId = string & { readonly __brand: 'CanonicalVerseId' };

export type Testament = 'OT' | 'NT';

/**
 * Which canon a book belongs to.
 *
 * Kept separate from `Testament` rather than widening it: a deuterocanonical
 * book still sits in the Old Testament era, and translations disagree about
 * inclusion rather than about era. Douay-Rheims, the Septuagints and
 * KJV-with-Apocrypha carry these books; the 66-book Protestant editions do
 * not, and the same `BookId` must mean the same book in both.
 */
export type Canon = 'protestant' | 'deuterocanonical';

/**
 * A reference to a verse or a contiguous range within one chapter.
 *
 * `verseEnd` is absent for a single verse. When present it is inclusive and
 * must be greater than or equal to `verseStart`.
 */
export interface BibleReference {
  readonly bookId: BookId;
  readonly chapter: number;
  readonly verseStart: number;
  readonly verseEnd?: number;
}

/** Canonical book metadata. */
export interface Book {
  readonly id: BookId;
  readonly name: string;
  readonly testament: Testament;
  /** Position in canonical order, 1-based. */
  readonly order: number;
  /** Verse count per chapter, index 0 being chapter 1. */
  readonly chapterVerseCounts: readonly number[];
}

/** A single verse in a single translation. */
export interface Verse {
  readonly id: CanonicalVerseId;
  readonly reference: BibleReference;
  readonly translation: TranslationCode;
  readonly text: string;
}
