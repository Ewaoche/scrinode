import { describe, expect, it } from 'vitest';
import {
  bookCodeFromFilename,
  buildManifest,
  processArchive,
  releaseNotes,
  toVerseDocuments,
  validateRelease,
  type ArchiveEntry,
} from './pipeline.js';
import { verseDocumentId, verseOrdinal } from './documents.js';
import { releasePaths, assertValidRelease, latestPointerPath } from './layout.js';

const usfm = (id: string, body: string): string => `\\id ${id}\n\\h ${id}\n${body}`;

const romans: ArchiveEntry = {
  name: '45-ROMengbsb.usfm',
  content: usfm('ROM', '\\c 8\n\\v 28 And we know.\n\\v 29 For those He foreknew.'),
};

const tobit: ArchiveEntry = {
  name: '41-TOBengDRA.usfm',
  content: usfm('TOB', '\\c 1\n\\v 1 Tobias of the tribe of Nephtali.'),
};

const frontMatter: ArchiveEntry = {
  name: '00-FRTengbsb.usfm',
  content: usfm('FRT', '\\p Front matter with no verses.'),
};

describe('bookCodeFromFilename', () => {
  it('reads eBible.org naming', () => {
    expect(bookCodeFromFilename('45-ROMengbsb.usfm')).toBe('ROM');
    expect(bookCodeFromFilename('00-FRTeng-kjv.usfm')).toBe('FRT');
  });

  it('returns undefined when the name carries no code', () => {
    expect(bookCodeFromFilename('readme.txt')).toBeUndefined();
  });
});

describe('processArchive', () => {
  it('parses Scripture files and orders them canonically', () => {
    const result = processArchive([romans, tobit]);
    expect(result.books).toHaveLength(2);
    // Tobit's order continues past the Protestant canon, so Romans precedes it.
    expect(result.books[0]?.book.bookId).toBe('ROM');
    expect(result.books[1]?.book.bookId).toBe('TOB');
  });

  it('records the canon of each book', () => {
    const result = processArchive([romans, tobit]);
    expect(result.books[0]?.canon).toBe('protestant');
    expect(result.books[1]?.canon).toBe('deuterocanonical');
  });

  it('skips peripheral files rather than failing', () => {
    // A publisher archive is not under our control and ships glossaries,
    // indexes and front matter alongside Scripture.
    const result = processArchive([romans, frontMatter]);
    expect(result.books).toHaveLength(1);
    expect(result.skipped).toContain('00-FRTengbsb.usfm');
  });

  it('skips book codes neither canon recognises', () => {
    const unknown: ArchiveEntry = {
      name: '99-ZZZengbsb.usfm',
      content: usfm('ZZZ', '\\c 1\n\\v 1 Unknown book.'),
    };
    const result = processArchive([unknown]);
    expect(result.books).toHaveLength(0);
    expect(result.skipped).toContain('99-ZZZengbsb.usfm');
  });

  it('trusts the id marker over the filename', () => {
    const mismatched: ArchiveEntry = {
      name: '45-XYZengbsb.usfm',
      content: usfm('ROM', '\\c 1\n\\v 1 Paul, a servant.'),
    };
    expect(processArchive([mismatched]).books[0]?.book.bookId).toBe('ROM');
  });

  it('hashes each book so a changed source is detectable', () => {
    const [first] = processArchive([romans]).books;
    const [again] = processArchive([romans]).books;
    expect(first?.sha256).toBe(again?.sha256);
    expect(first?.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('toVerseDocuments', () => {
  const documents = toVerseDocuments('BSB', '2026-08-08', processArchive([romans]).books);

  it('builds deterministic ids so re-import is idempotent', () => {
    expect(documents[0]?._id).toBe('BSB:ROM.8.28');
    expect(documents[0]?._id).toBe(verseDocumentId('bsb', 'rom', 8, 28));
  });

  it('carries the translation-independent reference separately', () => {
    // Comparison across translations queries by ref, not by _id.
    expect(documents[0]?.ref).toBe('ROM.8.28');
  });

  it('records canon, release and ordinal', () => {
    expect(documents[0]).toMatchObject({
      canon: 'protestant',
      release: '2026-08-08',
      ordinal: verseOrdinal(45, 8, 28),
    });
  });

  it('omits verseEnd for ordinary single verses', () => {
    expect(documents[0]).not.toHaveProperty('verseEnd');
  });

  it('records verseEnd only where an edition merged verses', () => {
    const merged = processArchive([
      { name: '19-PSAx.usfm', content: usfm('PSA', '\\c 1\n\\v 1-2 Blessed is the man.') },
    ]).books;

    expect(toVerseDocuments('KJV', '2026-01-01', merged)[0]).toMatchObject({
      verse: 1,
      verseEnd: 2,
    });
  });

  it('stamps documents with the release it was given', () => {
    // The loader passes the MANIFEST's release, not the one pinned in
    // sources.ts. When those disagreed, documents were written under one
    // release and immediately deleted by the stale sweep, which matched on
    // the other — silently emptying the translation.
    const docs = toVerseDocuments('BSB', '2026-12-25', processArchive([romans]).books);
    expect(docs.every((d) => d.release === '2026-12-25')).toBe(true);
  });

  it('sorts by ordinal in reading order', () => {
    const ordinals = documents.map((d) => d.ordinal);
    expect([...ordinals].sort((a, b) => a - b)).toEqual(ordinals);
  });
});

describe('verseOrdinal', () => {
  it('keeps books, chapters and verses in reading order', () => {
    expect(verseOrdinal(1, 1, 1)).toBeLessThan(verseOrdinal(1, 1, 2));
    expect(verseOrdinal(1, 1, 999)).toBeLessThan(verseOrdinal(1, 2, 1));
    expect(verseOrdinal(1, 999, 999)).toBeLessThan(verseOrdinal(2, 1, 1));
  });

  it('leaves room for the longest chapter and book in Scripture', () => {
    // Psalm 119 has 176 verses; Psalms has 150 chapters.
    expect(verseOrdinal(19, 119, 176)).toBeLessThan(verseOrdinal(19, 120, 1));
    expect(verseOrdinal(19, 150, 6)).toBeLessThan(verseOrdinal(20, 1, 1));
  });
});

describe('buildManifest', () => {
  const result = processArchive([romans, frontMatter]);
  const manifest = buildManifest(
    {
      translation: 'bsb',
      translationName: 'Berean Standard Bible',
      release: '2026-08-08',
      sourceUrl: 'https://berean.bible/downloads.htm',
      licenceName: 'Public domain',
      licenceUrl: 'https://berean.bible/terms.htm',
      rightsHolder: 'public domain',
      archive: Buffer.from('archive bytes'),
      fetchedAt: new Date('2026-09-20T00:00:00Z'),
    },
    result,
  );

  it('records provenance required by AGENTS.md §21', () => {
    expect(manifest).toMatchObject({
      translation: 'BSB',
      sourceUrl: 'https://berean.bible/downloads.htm',
      licenceName: 'Public domain',
      rightsHolder: 'public domain',
    });
    expect(manifest.fetchedAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('hashes the publisher archive so the licensed bytes are provable', () => {
    expect(manifest.archiveSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.archiveBytes).toBe(Buffer.from('archive bytes').byteLength);
  });

  it('totals books, chapters and verses', () => {
    expect(manifest.totals).toEqual({ books: 1, chapters: 1, verses: 2 });
  });

  it('records what was skipped so the decision is auditable', () => {
    expect(manifest.skipped).toContain('00-FRTengbsb.usfm');
  });

  it('records per-book verse counts, which vary by translation', () => {
    // books.ts deliberately stores no verse counts; this is where the real
    // numbers live, per translation.
    expect(manifest.books[0]).toMatchObject({ bookId: 'ROM', verses: 2, chapters: 1 });
  });
});

describe('validateRelease', () => {
  const result = processArchive([romans]);
  const documents = toVerseDocuments('BSB', '2026-08-08', result.books);
  const manifest = buildManifest(
    {
      translation: 'BSB',
      translationName: 'Berean Standard Bible',
      release: '2026-08-08',
      sourceUrl: 'https://berean.bible/',
      licenceName: 'Public domain',
      licenceUrl: 'https://berean.bible/terms.htm',
      rightsHolder: 'public domain',
      archive: Buffer.from('x'),
      fetchedAt: new Date(),
    },
    result,
  );

  it('passes a sound release', () => {
    expect(validateRelease(manifest, documents)).toEqual([]);
  });

  it('refuses an empty archive', () => {
    const empty = buildManifest(
      {
        translation: 'BSB',
        translationName: 'x',
        release: '2026-08-08',
        sourceUrl: 'x',
        licenceName: 'x',
        licenceUrl: 'x',
        rightsHolder: 'x',
        archive: Buffer.from('x'),
        fetchedAt: new Date(),
      },
      { books: [], skipped: [] },
    );

    expect(validateRelease(empty, [])).toContain('BSB: archive produced no books');
  });

  it('catches a count that disagrees with the documents produced', () => {
    const problems = validateRelease(manifest, documents.slice(0, 1));
    expect(problems.some((p) => p.includes('manifest claims 2 verses'))).toBe(true);
  });

  it('catches duplicate verse ids', () => {
    const duplicated = [...documents, documents[0]!];
    const problems = validateRelease({ ...manifest, totals: { ...manifest.totals, verses: 3 } }, duplicated);
    expect(problems.some((p) => p.includes('duplicate verse id'))).toBe(true);
  });

  it('accepts versification that differs from the registry', () => {
    // The registry records Hebrew versification; the Septuagint and Greek
    // editions legitimately differ. Brenton's Psalms has 151 chapters and its
    // Ezra merges Nehemiah into 23. Refusing those refuses the text.
    const septuagint = {
      ...manifest,
      books: [{ ...manifest.books[0]!, bookId: 'PSA', chapters: 151 }],
    };
    expect(validateRelease(septuagint, documents)).toEqual([]);
  });

  it('reports versification differences without failing the release', () => {
    const septuagint = {
      ...manifest,
      books: [{ ...manifest.books[0]!, bookId: 'PSA', chapters: 151 }],
    };
    expect(releaseNotes(septuagint)).toContain('PSA: 151 chapters (registry records 150)');
  });

  it('reports nothing when versification matches the registry', () => {
    const complete = {
      ...manifest,
      // Jude is one chapter in every tradition.
      books: [{ ...manifest.books[0]!, bookId: 'JUD', chapters: 1 }],
    };
    expect(releaseNotes(complete)).toEqual([]);
  });
});

describe('storage layout', () => {
  it('is derivable from data Scrinode already holds', () => {
    const paths = releasePaths('BSB', '2026-08-08');
    expect(paths.root).toBe('bibles/bsb/2026-08-08');
    expect(paths.archive).toBe('bibles/bsb/2026-08-08/source/archive.zip');
    expect(paths.usfm('rom')).toBe('bibles/bsb/2026-08-08/usfm/ROM.usfm');
    expect(paths.json('ROM')).toBe('bibles/bsb/2026-08-08/json/ROM.json');
  });

  it('keeps the latest pointer outside immutable release data', () => {
    expect(latestPointerPath('BSB')).toBe('bibles/bsb/latest.json');
  });

  it('rejects a release that is not a date', () => {
    // Releases are dates so a re-import never overwrites earlier bytes.
    expect(() => assertValidRelease('latest')).toThrow(/YYYY-MM-DD/);
    expect(() => releasePaths('BSB', '2026-8-8')).toThrow();
  });

  it('rejects path-unsafe identifiers', () => {
    expect(() => releasePaths('../etc', '2026-08-08')).toThrow(/path-safe/);
    expect(() => releasePaths('BSB', '2026-08-08').usfm('../x')).toThrow(/path-safe/);
  });
});
