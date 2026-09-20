import { createHash } from 'node:crypto';
import { getAnyBook } from '@scrinode/scripture';
import type { BookId, Canon, Testament, TranslationCode } from '@scrinode/types';
import {
  PASSAGE_STRIDE,
  PASSAGE_WINDOW,
  type RetrievalUnit,
  type RetrievalUnitType,
} from './retrieval.js';

/**
 * Building retrieval units from loaded verses.
 *
 * AGENTS.md §20 requires several granularities, because a question rarely
 * matches at one. "What does Paul say about suffering?" wants a passage;
 * "where does it say all things work together for good?" wants a verse.
 *
 * Units are built per chapter, since a passage never spans a chapter
 * boundary — doing so would produce references no reader could act on.
 */

/** The subset of a verse document unit-building needs. */
export interface VerseInput {
  readonly _id: string;
  readonly bookId: string;
  readonly chapter: number;
  readonly verse: number;
  readonly suffix?: string;
  readonly text: string;
  readonly ordinal: number;
  /** Carried through so a unit inherits its verses' canon. */
  readonly canon?: Canon;
}

export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function reference(bookId: string, chapter: number, verse: number, suffix?: string): string {
  return `${bookId}.${chapter}.${verse}${suffix ?? ''}`;
}

/**
 * Join verses into one block of text.
 *
 * Verse numbers are deliberately NOT interleaved. They would be embedded as
 * tokens and dilute the semantic signal, and the unit already records its
 * bounds structurally in `referenceStart` and `referenceEnd`.
 */
function joinText(verses: readonly VerseInput[]): string {
  return verses
    .map((v) => v.text.trim())
    .filter(Boolean)
    .join(' ');
}

interface UnitContext {
  readonly translation: string;
  readonly release: string;
  readonly canon: Canon;
  readonly sourceId: string;
}

function makeUnit(
  type: RetrievalUnitType,
  verses: readonly VerseInput[],
  context: UnitContext,
): RetrievalUnit | undefined {
  const first = verses[0];
  const last = verses[verses.length - 1];
  if (!first || !last) return undefined;

  const text = joinText(verses);
  if (!text) return undefined;

  const meta = getAnyBook(first.bookId);
  const testament: Testament = meta?.testament ?? 'OT';

  const start = reference(first.bookId, first.chapter, first.verse, first.suffix);
  const end = reference(last.bookId, last.chapter, last.verse, last.suffix);

  // A verse unit's id is its reference; wider units carry their range, so
  // every id is deterministic and re-running is idempotent.
  const id =
    type === 'verse'
      ? `${context.translation}:${type}:${start}`
      : `${context.translation}:${type}:${start}-${last.chapter}.${last.verse}${last.suffix ?? ''}`;

  return {
    _id: id,
    unitType: type,
    translation: context.translation as TranslationCode,
    bookId: first.bookId as BookId,
    canon: context.canon,
    testament,
    chapter: first.chapter,
    referenceStart: start,
    referenceEnd: end,
    text,
    verseIds: verses.map((v) => v._id),
    language: 'en',
    ordinal: first.ordinal,
    sourceId: context.sourceId,
    release: context.release,
    textHash: textHash(text),
  };
}

/**
 * Build every derivable unit for one chapter.
 *
 * Produces:
 *   verse    one per verse, for precise lookup
 *   passage  overlapping windows, for context
 *   chapter  the whole chapter, for broad questions
 *
 * The overlap matters: a passage boundary falling mid-argument would make
 * that argument unretrievable as a whole. Stepping by half the window means
 * every span of `PASSAGE_STRIDE` verses appears intact in some unit.
 */
export function buildChapterUnits(
  verses: readonly VerseInput[],
  context: UnitContext,
): RetrievalUnit[] {
  if (verses.length === 0) return [];

  const ordered = [...verses].sort((a, b) => a.ordinal - b.ordinal);
  const units: RetrievalUnit[] = [];

  for (const verse of ordered) {
    const unit = makeUnit('verse', [verse], context);
    if (unit) units.push(unit);
  }

  // Only window when there is more than one window's worth; otherwise the
  // passage would duplicate the chapter unit exactly.
  if (ordered.length > PASSAGE_WINDOW) {
    for (let start = 0; start < ordered.length; start += PASSAGE_STRIDE) {
      const window = ordered.slice(start, start + PASSAGE_WINDOW);
      if (window.length < 2) break;

      const unit = makeUnit('passage', window, context);
      if (unit) units.push(unit);

      // The final window reaches the end; stop rather than emit shrinking
      // tails that all end on the same verse.
      if (start + PASSAGE_WINDOW >= ordered.length) break;
    }
  }

  const chapterUnit = makeUnit('chapter', ordered, context);
  if (chapterUnit) units.push(chapterUnit);

  return units;
}

/**
 * Whether a unit needs embedding.
 *
 * Re-embedding costs money and time, so it happens only when there is no
 * vector, when the text changed, or when the model changed. Comparing the
 * text hash rather than the text keeps the check cheap over ~200k units.
 */
export function needsEmbedding(
  unit: Pick<RetrievalUnit, 'embedding' | 'embeddingModel' | 'textHash' | 'text'>,
  model: string,
): boolean {
  // `length()` is the byte length, which includes a header and is never
  // zero. The dimension count is what matters.
  if (!unit.embedding || unit.embedding.toFloat32Array().length === 0) return true;
  if (unit.embeddingModel !== model) return true;
  if (unit.textHash !== textHash(unit.text)) return true;
  return false;
}
