/**
 * Object-storage layout for Bible source data.
 *
 * Two rules shape every path here.
 *
 * **Immutability.** A path always contains the source's release date, so a
 * re-import never overwrites what an earlier import read. eBible.org revises
 * its texts — the KJV archive carries a 2026 source date — and a verse that
 * silently changes under a saved note or a published sermon is a correctness
 * failure, not a refresh. Old versions stay addressable forever.
 *
 * **Referenceability.** Every path is derivable from data Scrinode already
 * holds: a `TranslationCode`, a `BookId`, a release. Nothing needs a lookup
 * table to find its bytes, so `sources` provenance records stay small and a
 * broken record can be reconstructed from the object store itself.
 *
 * ```text
 * bibles/
 *   <translation>/                 registry code, lowercased: bsb, web, kjv
 *     <release>/                   source date, YYYY-MM-DD
 *       source/
 *         archive.zip              the publisher's bytes, byte-for-byte
 *         manifest.json            checksums, counts, provenance
 *       usfm/
 *         <BOOK>.usfm              one file per book, as shipped
 *       json/
 *         <BOOK>.json              parsed verses, ready to load
 *         index.json               books, chapters, verse counts
 *     latest.json                  pointer to the current release
 * ```
 *
 * The `source/archive.zip` copy is what makes the rest trustworthy: parsing
 * can be re-run and corrected without going back to the publisher, and the
 * checksum proves the bytes are the ones whose licence was verified.
 */

/** Object key prefix for everything Bible-source related. */
export const BIBLE_PREFIX = 'bibles';

/** A release is identified by the source's own publication date. */
export type Release = string;

const RELEASE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertValidRelease(release: string): asserts release is Release {
  if (!RELEASE_PATTERN.test(release)) {
    throw new Error(`Release must be YYYY-MM-DD, received "${release}"`);
  }
}

/**
 * Normalise a translation code for use in a path.
 *
 * Lowercased because object stores are case-sensitive and mixed case in keys
 * is a recurring source of "works locally, 404s in production".
 */
function segment(translation: string): string {
  const trimmed = translation.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(trimmed)) {
    throw new Error(`Translation code is not path-safe: "${translation}"`);
  }
  return trimmed;
}

function bookSegment(bookId: string): string {
  const upper = bookId.trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(upper)) {
    throw new Error(`Book id is not path-safe: "${bookId}"`);
  }
  return upper;
}

export interface ReleasePaths {
  readonly root: string;
  readonly archive: string;
  readonly manifest: string;
  readonly index: string;
  usfm(bookId: string): string;
  json(bookId: string): string;
}

/** Every path for one translation release. */
export function releasePaths(translation: string, release: string): ReleasePaths {
  assertValidRelease(release);
  const base = `${BIBLE_PREFIX}/${segment(translation)}/${release}`;

  return {
    root: base,
    archive: `${base}/source/archive.zip`,
    manifest: `${base}/source/manifest.json`,
    index: `${base}/json/index.json`,
    usfm: (bookId: string) => `${base}/usfm/${bookSegment(bookId)}.usfm`,
    json: (bookId: string) => `${base}/json/${bookSegment(bookId)}.json`,
  };
}

/**
 * Pointer to the release currently loaded into the database.
 *
 * Kept outside the release directory so it can be updated atomically without
 * touching immutable data, and read by anything that needs "the current text"
 * without knowing dates.
 */
export function latestPointerPath(translation: string): string {
  return `${BIBLE_PREFIX}/${segment(translation)}/latest.json`;
}

/** Contents of `latest.json`. */
export interface LatestPointer {
  readonly translation: string;
  readonly release: Release;
  readonly updatedAt: string;
}

/**
 * Per-book record inside a manifest.
 *
 * Verse counts are recorded per book per translation because versification
 * differs between translations — BSB and WEB disagree by 17 verses over the
 * same 1,189 chapters. `books.ts` deliberately stores no verse counts for
 * this reason, so the manifest is where the real numbers live.
 */
export interface ManifestBook {
  readonly bookId: string;
  readonly name: string;
  readonly canon: 'protestant' | 'deuterocanonical';
  readonly chapters: number;
  readonly verses: number;
  /** SHA256 of the USFM file as shipped. */
  readonly sha256: string;
}

/**
 * What a release records about itself.
 *
 * This is the §21 provenance record in file form: where the bytes came from,
 * what licence governs them, when they were taken and what they hashed to.
 */
export interface Manifest {
  readonly translation: string;
  readonly translationName: string;
  readonly release: Release;
  readonly sourceUrl: string;
  readonly licenceName: string;
  readonly licenceUrl: string;
  readonly rightsHolder: string;
  /** SHA256 of the publisher's archive, before anything was extracted. */
  readonly archiveSha256: string;
  readonly archiveBytes: number;
  readonly fetchedAt: string;
  readonly books: readonly ManifestBook[];
  readonly totals: {
    readonly books: number;
    readonly chapters: number;
    readonly verses: number;
  };
  /** USFM files present in the archive that are not Scripture. */
  readonly skipped: readonly string[];
}
