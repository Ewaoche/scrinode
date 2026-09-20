/**
 * USFM parsing.
 *
 * USFM is the format eBible.org and most Bible publishers distribute. It is
 * line-oriented markup: `\c 8` opens a chapter, `\v 28` opens a verse, and
 * verse text runs until the next marker.
 *
 * This parser extracts canonical verse text and nothing else. It is
 * deliberately narrow — Scrinode stores verses, and section headings,
 * footnotes and cross-reference apparatus belong to their own layers with
 * their own provenance (AGENTS.md §21).
 *
 * What it must get right, because silent corruption here poisons everything
 * downstream:
 *
 * - verse text spanning several lines
 * - verse ranges (`\v 1-2`) which some editions use for merged verses
 * - character markup removed without eating the words it wraps
 * - footnotes and cross-references removed WITH their contents
 * - Strong's numbers stripped from display text but recoverable
 */

/** One verse as it appears in a USFM file. */
export interface ParsedVerse {
  readonly chapter: number;
  /** First verse number. Equals `verseEnd` unless the edition merged verses. */
  readonly verse: number;
  /** Last verse number of a merged range, else the same as `verse`. */
  readonly verseEnd: number;
  /**
   * Letter suffix where an edition subdivides a verse, e.g. the `a` of
   * `\v 50a`. Absent for ordinary verses.
   *
   * The Septuagint translations and Greek Esther use these for material with
   * no Hebrew counterpart. They are real, distinct verses — Brenton's Genesis
   * has both 31:50 and 31:50a — so the suffix is part of the verse's
   * identity, not noise to discard.
   */
  readonly suffix?: string;
  /** Display text, markup removed. */
  readonly text: string;
}

export interface ParsedBook {
  /** Three-letter code from `\id`, e.g. `ROM`. */
  readonly bookId: string;
  /** Book name from `\h`, where the file provides one. */
  readonly heading?: string;
  readonly verses: readonly ParsedVerse[];
}

/**
 * Markers whose CONTENT is dropped along with the marker.
 *
 * Footnotes and cross-references are editorial apparatus. Leaving their text
 * in would splice commentary into Scripture, which §2 forbids — Scripture and
 * interpretation must stay visibly distinct.
 */
const CONTENT_BEARING_MARKERS = /\\(f|fe|x|ef|ex)\s.*?\\\1\*/gs;

/**
 * Strong's numbers and other word-level attributes.
 *
 * `\w Paul|strong="G3972"\w*` becomes `Paul`. The lemma data is real and
 * useful, but it belongs to the original-language layer rather than display
 * text. `extractStrongs` recovers it from the same source.
 */
const WORD_WITH_ATTRIBUTES = /\\\+?w\s+([^|\\]*?)(?:\|[^\\]*?)?\\\+?w\*/g;

/** Figures, and any other marker carrying a `|attribute` payload. */
const FIGURE = /\\fig\s.*?\\fig\*/gs;

/** Remaining character-level markers: `\add ... \add*`, `\nd ... \nd*`. */
const CHARACTER_MARKER_PAIR = /\\\+?([a-z][a-z0-9]*)\s(.*?)\\\+?\1\*/gs;

/** Any leftover standalone marker. */
const STANDALONE_MARKER = /\\[a-z][a-z0-9]*\*?/gi;

/**
 * Strip USFM markup down to display text.
 *
 * Order matters: content-bearing markers go first so their inner text leaves
 * with them, then word attributes, then paired character markers whose inner
 * text is kept, then anything left over.
 */
export function stripMarkup(input: string): string {
  let text = input;

  text = text.replace(CONTENT_BEARING_MARKERS, '');
  text = text.replace(FIGURE, '');
  text = text.replace(WORD_WITH_ATTRIBUTES, '$1');

  // Character pairs can nest, so apply until stable rather than once.
  let previous: string;
  do {
    previous = text;
    text = text.replace(CHARACTER_MARKER_PAIR, '$2');
  } while (text !== previous);

  text = text.replace(STANDALONE_MARKER, '');

  // USFM uses // for a discretionary line break and ~ for a fixed space.
  text = text.replace(/\/\//g, ' ').replace(/~/g, ' ');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Recover Strong's numbers from a verse's raw USFM.
 *
 * Kept separate from display parsing: the BSB and a few other texts carry
 * lemma data inline, and discarding it at ingestion would mean re-fetching
 * every source when the original-language layer is built.
 */
export function extractStrongs(raw: string): readonly { word: string; strong: string }[] {
  const found: { word: string; strong: string }[] = [];
  const pattern = /\\\+?w\s+([^|\\]*?)\|(?:[^\\]*?)strong="([^"]+)"[^\\]*?\\\+?w\*/g;

  for (const match of raw.matchAll(pattern)) {
    const word = match[1]?.trim();
    const strong = match[2];
    if (word && strong) found.push({ word, strong });
  }

  return found;
}

/**
 * Parse a `\v` token.
 *
 * Three forms occur in these archives:
 *   `28`    ordinary verse
 *   `1-2`   verses merged by the edition
 *   `50a`   a subdivision, used by the Septuagints and Greek Esther
 *
 * The suffix is preserved rather than stripped: Brenton's Genesis contains
 * both 31:50 and 31:50a, so discarding it would silently collapse two
 * distinct verses into one and lose text.
 */
function parseVerseNumber(
  token: string,
): { verse: number; verseEnd: number; suffix?: string } | undefined {
  const match = /^(\d+)(?:[-–](\d+))?([a-z])?/.exec(token);
  if (!match?.[1]) return undefined;

  const verse = Number.parseInt(match[1], 10);
  const verseEnd = match[2] ? Number.parseInt(match[2], 10) : verse;
  const suffix = match[3];

  if (!Number.isFinite(verse) || verse < 1) return undefined;
  if (verseEnd < verse) return undefined;

  return { verse, verseEnd, ...(suffix ? { suffix } : {}) };
}

/**
 * Parse one USFM book file.
 *
 * Returns verses in document order. Verses with no text after stripping —
 * which happens where an edition marks a verse present but empty — are
 * omitted rather than stored blank, so a missing verse is distinguishable
 * from an empty one.
 */
export function parseUsfm(content: string): ParsedBook {
  const lines = content.split(/\r?\n/);

  let bookId = '';
  let heading: string | undefined;
  let chapter = 0;

  const verses: ParsedVerse[] = [];
  let current:
    | { chapter: number; verse: number; verseEnd: number; suffix?: string; parts: string[] }
    | undefined;

  const flush = (): void => {
    if (!current) return;
    const text = stripMarkup(current.parts.join(' '));
    if (text) {
      verses.push({
        chapter: current.chapter,
        verse: current.verse,
        verseEnd: current.verseEnd,
        ...(current.suffix ? { suffix: current.suffix } : {}),
        text,
      });
    }
    current = undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const idMatch = /^\\id\s+(\S+)/.exec(trimmed);
    if (idMatch?.[1]) {
      bookId = idMatch[1].toUpperCase();
      continue;
    }

    const headingMatch = /^\\h\s+(.+)$/.exec(trimmed);
    if (headingMatch?.[1]) {
      heading = stripMarkup(headingMatch[1]);
      continue;
    }

    const chapterMatch = /^\\c\s+(\d+)/.exec(trimmed);
    if (chapterMatch?.[1]) {
      flush();
      chapter = Number.parseInt(chapterMatch[1], 10);
      continue;
    }

    const verseMatch = /^\\v\s+(\S+)\s*(.*)$/s.exec(trimmed);
    if (verseMatch?.[1]) {
      flush();
      const numbers = parseVerseNumber(verseMatch[1]);
      if (numbers && chapter > 0) {
        current = { chapter, ...numbers, parts: verseMatch[2] ? [verseMatch[2]] : [] };
      }
      continue;
    }

    // A paragraph marker inside a verse continues it; the text after the
    // marker is still that verse's text.
    if (current && /^\\[a-z]/i.test(trimmed)) {
      const withoutMarker = trimmed.replace(/^\\[a-z][a-z0-9]*\*?\s*/i, '');
      if (withoutMarker) current.parts.push(withoutMarker);
      continue;
    }

    if (current) current.parts.push(trimmed);
  }

  flush();

  return { bookId, ...(heading ? { heading } : {}), verses };
}
