import { createHash } from 'node:crypto';
import { getAnyBook, canonOf, USFM_NON_BOOK_CODES } from '@scrinode/scripture';
import type { Canon } from '@scrinode/types';
import { parseUsfm, type ParsedBook } from './usfm.js';
import type { Manifest, ManifestBook } from './layout.js';
import {
  canonicalRef,
  verseDocumentId,
  verseOrdinal,
  type VerseDocument,
} from './documents.js';

/** SHA256 as lowercase hex. */
export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * A USFM file pulled out of a publisher archive.
 *
 * `name` is the archive's own filename, kept so the manifest can report what
 * was skipped using the name a human would see in the zip.
 */
export interface ArchiveEntry {
  readonly name: string;
  readonly content: string;
}

/**
 * Extract the book code from an eBible.org USFM filename.
 *
 * Archives name files `NN-BOOKID<translation>.usfm`, e.g.
 * `45-ROMengbsb.usfm`. The `\id` marker inside is authoritative, so this is
 * only a pre-filter for peripheral files that would otherwise be parsed for
 * nothing.
 */
export function bookCodeFromFilename(filename: string): string | undefined {
  const match = /^[0-9A-Za-z]*-?([A-Z0-9]{3})/.exec(filename);
  return match?.[1]?.toUpperCase();
}

export interface BookResult {
  readonly book: ParsedBook;
  readonly canon: Canon;
  readonly name: string;
  readonly order: number;
  readonly chapters: number;
  readonly sha256: string;
}

export interface ProcessResult {
  readonly books: readonly BookResult[];
  /** Filenames present in the archive that hold no Scripture. */
  readonly skipped: readonly string[];
}

/**
 * Parse every Scripture file in an archive.
 *
 * Skips, rather than fails on:
 *
 * - peripheral USFM files (front matter, glossaries, indexes)
 * - book codes neither canon recognises
 * - files that parse to zero verses
 *
 * A publisher archive is not under Scrinode's control and will contain
 * surprises. Failing the whole import because one edition ships a glossary
 * would make the pipeline unusable; recording what was skipped keeps the
 * decision auditable.
 */
export function processArchive(entries: readonly ArchiveEntry[]): ProcessResult {
  const books: BookResult[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const filenameCode = bookCodeFromFilename(entry.name);

    if (filenameCode && USFM_NON_BOOK_CODES.has(filenameCode)) {
      skipped.push(entry.name);
      continue;
    }

    const parsed = parseUsfm(entry.content);

    // The \id marker inside the file wins over the filename.
    const code = parsed.bookId || filenameCode;
    if (!code || USFM_NON_BOOK_CODES.has(code)) {
      skipped.push(entry.name);
      continue;
    }

    const meta = getAnyBook(code);
    const canon = canonOf(code);
    if (!meta || !canon) {
      skipped.push(entry.name);
      continue;
    }

    if (parsed.verses.length === 0) {
      skipped.push(entry.name);
      continue;
    }

    const chapters = new Set(parsed.verses.map((v) => v.chapter)).size;

    books.push({
      book: { ...parsed, bookId: code },
      canon,
      name: meta.name,
      order: meta.order,
      chapters,
      sha256: sha256(entry.content),
    });
  }

  books.sort((a, b) => a.order - b.order);

  return { books, skipped };
}

/** Turn parsed books into verse rows ready for the database. */
export function toVerseDocuments(
  translation: string,
  release: string,
  books: readonly BookResult[],
): VerseDocument[] {
  const documents: VerseDocument[] = [];

  for (const result of books) {
    for (const verse of result.book.verses) {
      const bookId = result.book.bookId;

      documents.push({
        _id: verseDocumentId(translation, bookId, verse.chapter, verse.verse, verse.suffix),
        translation: translation.toUpperCase() as VerseDocument['translation'],
        bookId: bookId as VerseDocument['bookId'],
        canon: result.canon,
        chapter: verse.chapter,
        verse: verse.verse,
        ...(verse.verseEnd !== verse.verse ? { verseEnd: verse.verseEnd } : {}),
        ...(verse.suffix ? { suffix: verse.suffix } : {}),
        ref: canonicalRef(bookId, verse.chapter, verse.verse, verse.suffix),
        text: verse.text,
        ordinal: verseOrdinal(result.order, verse.chapter, verse.verse),
        release,
      });
    }
  }

  return documents;
}

export interface ManifestInput {
  readonly translation: string;
  readonly translationName: string;
  readonly release: string;
  readonly sourceUrl: string;
  readonly licenceName: string;
  readonly licenceUrl: string;
  readonly rightsHolder: string;
  readonly archive: Buffer;
  readonly fetchedAt: Date;
}

/** Build the §21 provenance record for a release. */
export function buildManifest(input: ManifestInput, result: ProcessResult): Manifest {
  const books: ManifestBook[] = result.books.map((b) => ({
    bookId: b.book.bookId,
    name: b.name,
    canon: b.canon,
    chapters: b.chapters,
    verses: b.book.verses.length,
    sha256: b.sha256,
  }));

  return {
    translation: input.translation.toUpperCase(),
    translationName: input.translationName,
    release: input.release,
    sourceUrl: input.sourceUrl,
    licenceName: input.licenceName,
    licenceUrl: input.licenceUrl,
    rightsHolder: input.rightsHolder,
    archiveSha256: sha256(input.archive),
    archiveBytes: input.archive.byteLength,
    fetchedAt: input.fetchedAt.toISOString(),
    books,
    totals: {
      books: books.length,
      chapters: books.reduce((sum, b) => sum + b.chapters, 0),
      verses: books.reduce((sum, b) => sum + b.verses, 0),
    },
    skipped: result.skipped,
  };
}

/**
 * Checks a release must pass before it may be loaded.
 *
 * Production-first (AGENTS.md): a malformed import that reaches the database is
 * far more expensive to undo than one refused here. Every failure names the
 * translation and what was wrong, because these run over 34 texts at once.
 */
export function validateRelease(manifest: Manifest, documents: readonly VerseDocument[]): string[] {
  const problems: string[] = [];
  const where = manifest.translation;

  if (manifest.totals.books === 0) {
    problems.push(`${where}: archive produced no books`);
  }

  if (manifest.totals.verses !== documents.length) {
    problems.push(
      `${where}: manifest claims ${manifest.totals.verses} verses but produced ${documents.length} documents`,
    );
  }

  const ids = new Set<string>();
  for (const doc of documents) {
    if (ids.has(doc._id)) {
      problems.push(`${where}: duplicate verse id ${doc._id}`);
      break;
    }
    ids.add(doc._id);
  }

  for (const doc of documents) {
    if (!doc.text.trim()) {
      problems.push(`${where}: empty text at ${doc._id}`);
      break;
    }
    if (doc.chapter < 1 || doc.verse < 1) {
      problems.push(`${where}: non-positive reference at ${doc._id}`);
      break;
    }
  }

  // Chapter counts are deliberately NOT compared against the registry.
  //
  // The registry records Hebrew/Protestant versification. These editions
  // legitimately differ, and every apparent excess investigated turned out to
  // be a real textual fact rather than a bug:
  //
  //   Brenton's Psalms has 151 chapters — Psalm 151 exists in the Greek
  //   Greek Esther has 16 — it carries additions with no Hebrew counterpart
  //   Douay-Rheims Daniel has 14 — Susanna and Bel are chapters there
  //   Brenton's Ezra has 23 — its \h reads "Ezra and Nehemiah", merged
  //
  // Rejecting those would be refusing the text. `releaseNotes` reports the
  // differences so an import is still reviewable, and the checks above —
  // duplicate ids, empty text, count mismatches — catch parsing faults
  // without needing a versification assumption that does not hold.

  return problems;
}

/**
 * Differences worth reporting that are not failures.
 *
 * Versification varies legitimately between textual traditions, and an
 * importer that says nothing about it hides real information from whoever
 * reviews the import.
 */
export function releaseNotes(manifest: Manifest): string[] {
  const notes: string[] = [];

  for (const book of manifest.books) {
    const meta = getAnyBook(book.bookId);
    if (meta && book.chapters !== meta.chapters) {
      notes.push(
        `${book.bookId}: ${book.chapters} chapters (registry records ${meta.chapters})`,
      );
    }
  }

  return notes;
}
