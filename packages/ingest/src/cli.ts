#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fromBuffer } from 'yauzl';
import { getAnyBook } from '@scrinode/scripture';
import { loadDotEnv } from './env.js';
import {
  BIBLE_SOURCES,
  archiveUrl,
  detailsUrl,
  findSource,
  type BibleSource,
} from './sources.js';
import {
  buildManifest,
  processArchive,
  sha256,
  releaseNotes,
  toVerseDocuments,
  validateRelease,
  type ArchiveEntry,
} from './pipeline.js';
import { latestPointerPath, releasePaths, type Manifest } from './layout.js';
import { TABLES, type VerseDocument } from './documents.js';
import {
  DERIVABLE_UNIT_TYPES,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  HNSW_EF_SEARCH,
  RETRIEVAL_TABLE,
  VECTOR_INDEX_NAME,
  toVectorLiteral,
  type RetrievalUnit,
} from './retrieval.js';
import type { Pool } from 'pg';
import { batchSizeFor, openPool, valuesClause } from './db.js';
import { buildChapterUnits, needsEmbedding, type VerseInput } from './units.js';
import { EMBED_BATCH_SIZE, embedBatch } from './voyage.js';
import { formatRange, searchUnits } from './search.js';
import {
  LEDGER_TABLE,
  isUpToDate,
  reasonToRun,
  runId,
  type IngestRun,
  type IngestStage,
} from './ledger.js';

/**
 * Bible ingestion CLI.
 *
 * Four stages, each independently re-runnable:
 *
 *   fetch   download publisher archives to a local staging tree
 *   parse   USFM to verse JSON, with manifests and validation
 *   upload  staging tree to DigitalOcean Spaces
 *   load    verse rows into Postgres
 *
 * Separate stages because they fail differently and cost differently.
 * Downloading 34 archives is slow and network-bound; parsing is fast and
 * deterministic; uploading costs bandwidth; loading writes to a production
 * database. Re-running `parse` after a parser fix must not re-download 73MB,
 * and `load` must be provable against local JSON before it touches Mongo.
 *
 * Credentials come from the environment and are never written to the staging
 * tree, logged, or committed.
 */

// Before anything reads configuration. The CLI is documented as runnable
// directly, so it must find .env itself rather than depending on a wrapper.
const DOTENV_PATH = loadDotEnv(process.cwd());

const STAGING = process.env.INGEST_DIR ?? '.ingest';

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/** Unzip in memory; these archives are a few megabytes each. */
async function readArchive(buffer: Buffer): Promise<ArchiveEntry[]> {
  return new Promise((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error('Could not open archive'));

      const entries: ArchiveEntry[] = [];

      zip.on('entry', (entry) => {
        if (!/\.usfm$/i.test(entry.fileName)) return zip.readEntry();

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error('Read failed'));

          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            entries.push({
              name: entry.fileName.replace(/^.*\//, ''),
              content: Buffer.concat(chunks).toString('utf8'),
            });
            zip.readEntry();
          });
          stream.on('error', reject);
        });
      });

      zip.on('end', () => resolve(entries));
      zip.on('error', reject);
      zip.readEntry();
    });
  });
}

function selectSources(argv: readonly string[]): readonly BibleSource[] {
  const codes = argv.filter((a) => !a.startsWith('-'));
  if (codes.length === 0) return BIBLE_SOURCES;

  return codes.map((code) => {
    const source = findSource(code);
    if (!source) fail(`Unknown translation "${code}". Run "list" to see available codes.`);
    return source;
  });
}

async function write(path: string, data: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

/**
 * Open a ledger connection.
 *
 * The ledger lives in MongoDB even for the upload stage, so both scripts
 * answer "what changed?" from one place that survives a rebuilt machine and
 * is visible to every operator.
 */
async function openLedger(): Promise<{
  read: (translation: string, release: string, stage: IngestStage) => Promise<IngestRun | null>;
  begin: (manifest: Manifest, stage: IngestStage) => Promise<void>;
  finish: (manifest: Manifest, stage: IngestStage, counts: Partial<IngestRun>) => Promise<void>;
  markFailed: (manifest: Manifest, stage: IngestStage, error: string) => Promise<void>;
  close: () => Promise<void>;
}> {
  const pool = openPool('Tracking', fail);
  const host = process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'unknown';

  return {
    read: async (translation, release, stage) => {
      const { rows } = await pool.query<LedgerRow>(
        `SELECT * FROM ${LEDGER_TABLE} WHERE id = $1`,
        [runId(translation, release, stage)],
      );

      const row = rows[0];
      return row ? toRun(row) : null;
    },

    begin: async (manifest, stage) => {
      // ON CONFLICT rather than delete-then-insert: a retry must leave no
      // window in which the row is absent, or a concurrent status read sees
      // "never run" for work that is in progress.
      await pool.query(
        `INSERT INTO ${LEDGER_TABLE}
           (id, translation, release, stage, manifest_sha256, status, started_at, host)
         VALUES ($1, $2, $3, $4, $5, 'running', now(), $6)
         ON CONFLICT (id) DO UPDATE SET
           manifest_sha256 = EXCLUDED.manifest_sha256,
           status          = 'running',
           started_at      = now(),
           completed_at    = NULL,
           error           = NULL,
           host            = EXCLUDED.host`,
        [
          runId(manifest.translation, manifest.release, stage),
          manifest.translation,
          manifest.release,
          stage,
          manifest.archiveSha256,
          host,
        ],
      );
    },

    finish: async (manifest, stage, counts) => {
      await pool.query(
        `UPDATE ${LEDGER_TABLE}
            SET status       = 'completed',
                completed_at = now(),
                error        = NULL,
                object_count = COALESCE($2, object_count),
                verse_count  = COALESCE($3, verse_count),
                book_count   = COALESCE($4, book_count)
          WHERE id = $1`,
        [
          runId(manifest.translation, manifest.release, stage),
          counts.objectCount ?? null,
          counts.verseCount ?? null,
          counts.bookCount ?? null,
        ],
      );
    },

    markFailed: async (manifest, stage, error) => {
      await pool.query(
        `UPDATE ${LEDGER_TABLE}
            SET status = 'failed', completed_at = now(), error = $2
          WHERE id = $1`,
        [runId(manifest.translation, manifest.release, stage), error],
      );
    },

    close: () => pool.end(),
  };
}

/** A ledger row as Postgres returns it. */
interface LedgerRow {
  id: string;
  translation: string;
  release: string;
  stage: IngestStage;
  manifest_sha256: string;
  status: IngestRun['status'];
  started_at: Date;
  completed_at: Date | null;
  object_count: number | null;
  verse_count: number | null;
  book_count: number | null;
  error: string | null;
  host: string | null;
}

function toRun(row: LedgerRow): IngestRun {
  return {
    _id: row.id,
    translation: row.translation,
    release: row.release,
    stage: row.stage,
    archiveSha256: row.manifest_sha256,
    status: row.status,
    startedAt: row.started_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.object_count !== null ? { objectCount: row.object_count } : {}),
    ...(row.verse_count !== null ? { verseCount: row.verse_count } : {}),
    ...(row.book_count !== null ? { bookCount: row.book_count } : {}),
    ...(row.error ? { error: row.error } : {}),
    ...(row.host ? { host: row.host } : {}),
  };
}

// --- stages ---------------------------------------------------------------

async function fetchStage(sources: readonly BibleSource[], force: boolean): Promise<void> {
  log(`Fetching ${sources.length} archive(s) into ${STAGING}/`);

  for (const source of sources) {
    const paths = releasePaths(source.code, source.release);
    const target = join(STAGING, paths.archive);

    if (!force && existsSync(target)) {
      log(`  ${source.code.padEnd(10)} cached`);
      continue;
    }

    const url = archiveUrl(source);
    const response = await fetch(url);
    if (!response.ok) {
      fail(`  ${source.code}: ${response.status} fetching ${url}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await write(target, buffer);
    log(`  ${source.code.padEnd(10)} ${(buffer.byteLength / 1024).toFixed(0)}KB  ${sha256(buffer).slice(0, 12)}`);
  }
}

async function parseStage(sources: readonly BibleSource[]): Promise<void> {
  log(`Parsing ${sources.length} archive(s)`);

  let failures = 0;

  for (const source of sources) {
    const paths = releasePaths(source.code, source.release);
    const archivePath = join(STAGING, paths.archive);

    if (!existsSync(archivePath)) {
      log(`  ${source.code.padEnd(10)} SKIP (not fetched)`);
      continue;
    }

    const archive = await readFile(archivePath);
    const entries = await readArchive(archive);
    const result = processArchive(entries);

    const manifest = buildManifest(
      {
        translation: source.code,
        translationName: source.name,
        release: source.release,
        sourceUrl: detailsUrl(source),
        licenceName: 'Public domain',
        licenceUrl: detailsUrl(source),
        rightsHolder: 'public domain',
        archive,
        fetchedAt: new Date(),
      },
      result,
    );

    const documents = toVerseDocuments(source.code, source.release, result.books);
    const problems = validateRelease(manifest, documents);

    if (problems.length > 0) {
      failures += 1;
      log(`  ${source.code.padEnd(10)} INVALID`);
      for (const problem of problems) log(`      ${problem}`);
      continue;
    }

    for (const book of result.books) {
      await write(
        join(STAGING, paths.usfm(book.book.bookId)),
        entries.find((e) => e.content.includes(`\\id ${book.book.bookId}`))?.content ?? '',
      );
      await write(
        join(STAGING, paths.json(book.book.bookId)),
        JSON.stringify({ bookId: book.book.bookId, verses: book.book.verses }, null, 1),
      );
    }

    await write(join(STAGING, paths.manifest), JSON.stringify(manifest, null, 2));
    await write(
      join(STAGING, paths.index),
      JSON.stringify(
        {
          translation: manifest.translation,
          release: manifest.release,
          books: manifest.books.map((b) => ({
            bookId: b.bookId,
            name: b.name,
            canon: b.canon,
            chapters: b.chapters,
            verses: b.verses,
          })),
          totals: manifest.totals,
        },
        null,
        1,
      ),
    );

    const notes = releaseNotes(manifest);

    log(
      `  ${source.code.padEnd(10)} ${String(manifest.totals.books).padStart(2)}bk ` +
        `${String(manifest.totals.chapters).padStart(4)}ch ${String(manifest.totals.verses).padStart(6)}v` +
        (manifest.skipped.length > 0 ? `  (${manifest.skipped.length} skipped)` : ''),
    );

    // Versification differences are real textual facts, not faults, but
    // whoever reviews an import should see them.
    for (const note of notes) log(`      note: ${note}`);
  }

  if (failures > 0) fail(`\n${failures} translation(s) failed validation. Nothing was loaded.`);
}

async function uploadStage(sources: readonly BibleSource[], force: boolean): Promise<void> {
  const endpoint = process.env.DO_SPACES_ENDPOINT;
  const bucket = process.env.DO_SPACES_BUCKET;
  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;
  const region = process.env.DO_SPACES_REGION ?? 'us-east-1';

  if (!endpoint || !bucket || !key || !secret) {
    fail(
      'Upload needs DO_SPACES_ENDPOINT, DO_SPACES_BUCKET, DO_SPACES_KEY and\n' +
        'DO_SPACES_SECRET in the environment. See .env.example.',
    );
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: false,
  });

  const put = async (objectKey: string, body: Buffer, contentType: string): Promise<void> => {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        // Source data is not public; the API serves text from MongoDB.
        ACL: 'private',
      }),
    );
  };

  const ledger = await openLedger();
  log(`Uploading ${sources.length} release(s) to ${bucket}`);

  let pushed = 0;
  let skipped = 0;

  try {
    for (const source of sources) {
      const paths = releasePaths(source.code, source.release);
      const manifestPath = join(STAGING, paths.manifest);

      if (!existsSync(manifestPath)) {
        log(`  ${source.code.padEnd(10)} SKIP (not parsed)`);
        continue;
      }

      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
      const previous = await ledger.read(manifest.translation, manifest.release, 'upload');

      if (!force && isUpToDate(previous, manifest)) {
        log(`  ${source.code.padEnd(10)} up to date (${previous?.objectCount ?? 0} objects)`);
        skipped += 1;
        continue;
      }

      await ledger.begin(manifest, 'upload');
      let count = 0;

      try {
        await put(paths.archive, await readFile(join(STAGING, paths.archive)), 'application/zip');
        await put(paths.manifest, Buffer.from(JSON.stringify(manifest)), 'application/json');
        await put(paths.index, await readFile(join(STAGING, paths.index)), 'application/json');
        count += 3;

        for (const book of manifest.books) {
          await put(
            paths.usfm(book.bookId),
            await readFile(join(STAGING, paths.usfm(book.bookId))),
            'text/plain',
          );
          await put(
            paths.json(book.bookId),
            await readFile(join(STAGING, paths.json(book.bookId))),
            'application/json',
          );
          count += 2;
        }

        // Written last: until it moves, the previous release is still the
        // current one, so an interrupted upload never leaves the pointer
        // aimed at a half-written release.
        await put(
          latestPointerPath(source.code),
          Buffer.from(
            JSON.stringify({
              translation: manifest.translation,
              release: manifest.release,
              updatedAt: new Date().toISOString(),
            }),
          ),
          'application/json',
        );
        count += 1;

        await ledger.finish(manifest, 'upload', {
          objectCount: count,
          bookCount: manifest.totals.books,
        });

        pushed += 1;
        log(`  ${source.code.padEnd(10)} ${count} objects  (${reasonToRun(previous, manifest)})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ledger.markFailed(manifest, 'upload', message);
        log(`  ${source.code.padEnd(10)} FAILED  ${message}`);
        throw error;
      }
    }

    log(`
${pushed} uploaded, ${skipped} already current.`);
  } finally {
    await ledger.close();
  }
}

async function loadStage(
  sources: readonly BibleSource[],
  registeredOnly: boolean,
  force: boolean,
): Promise<void> {
  const pool = openPool('Load', fail);
  const ledger = await openLedger();

  let loaded = 0;
  let skipped = 0;

  try {
    const selected = registeredOnly ? sources.filter((s) => s.registered) : sources;
    log(`Loading ${selected.length} translation(s) into Postgres`);

    for (const source of selected) {
      const paths = releasePaths(source.code, source.release);
      const manifestPath = join(STAGING, paths.manifest);

      if (!existsSync(manifestPath)) {
        log(`  ${source.code.padEnd(10)} SKIP (not parsed)`);
        continue;
      }

      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
      const previous = await ledger.read(manifest.translation, manifest.release, 'load');

      if (!force && isUpToDate(previous, manifest)) {
        log(`  ${source.code.padEnd(10)} up to date (${previous?.verseCount ?? 0} verses)`);
        skipped += 1;
        continue;
      }

      await ledger.begin(manifest, 'load');
      let written = 0;
      let staleRemoved = 0;

      try {
        // One book at a time: a whole Bible of verse rows is large enough
        // that a single statement risks memory and a long transaction.
        for (const book of manifest.books) {
          const parsed = JSON.parse(
            await readFile(join(STAGING, paths.json(book.bookId)), 'utf8'),
          ) as {
            bookId: string;
            verses: {
              chapter: number;
              verse: number;
              verseEnd: number;
              suffix?: string;
              text: string;
            }[];
          };

          // The manifest's release is authoritative, not the one pinned in
          // sources.ts: it describes the bytes that were actually parsed. If
          // the two disagree, rows would be written under one release and
          // then deleted by the stale sweep below, which expects the other.
          const documents = toVerseDocuments(source.code, manifest.release, [
            {
              book: { bookId: parsed.bookId, verses: parsed.verses },
              canon: book.canon,
              name: book.name,
              order: getAnyBook(book.bookId)?.order ?? 0,
              chapters: book.chapters,
              sha256: book.sha256,
            },
          ]);

          if (documents.length === 0) continue;

          written += await insertVerses(pool, documents);
        }

        // Verses from an earlier release of the same translation that this
        // release no longer contains. Left behind they would be served as
        // current text.
        staleRemoved = await deleteStaleVerses(pool, manifest);

        await upsertTranslation(pool, manifest, source.registered);

        await ledger.finish(manifest, 'load', {
          verseCount: written,
          bookCount: manifest.totals.books,
        });

        loaded += 1;
        log(
          `  ${source.code.padEnd(10)} ${String(written).padStart(6)} verses` +
            (staleRemoved > 0 ? `  (${staleRemoved} stale removed)` : '') +
            `  (${reasonToRun(previous, manifest)})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ledger.markFailed(manifest, 'load', message);
        log(`  ${source.code.padEnd(10)} FAILED  ${message}`);
        throw error;
      }
    }

    log(`\n${loaded} loaded, ${skipped} already current.`);
  } finally {
    await ledger.close();
    await pool.end();
  }
}

/** Columns written per verse row, in the order `insertVerses` supplies them. */
const VERSE_INSERT_COLUMNS = [
  'id',
  'translation',
  'reference_id',
  'book_id',
  'canon',
  'chapter',
  'verse',
  'verse_end',
  'suffix',
  'text',
  'ordinal',
  'release',
] as const;

/**
 * Insert or replace verse rows.
 *
 * `ON CONFLICT (id) DO UPDATE` keyed on the deterministic id, so a re-run
 * repairs rather than duplicates and a partial failure is safe to resume.
 * This is the replacement for MongoDB's upserting `bulkWrite`.
 */
async function insertVerses(
  pool: Pool,
  documents: readonly VerseDocument[],
): Promise<number> {
  const perBatch = batchSizeFor(VERSE_INSERT_COLUMNS.length);
  let written = 0;

  for (let i = 0; i < documents.length; i += perBatch) {
    const batch = documents.slice(i, i + perBatch);

    const { placeholders, params } = valuesClause(
      batch.map((doc) => [
        doc._id,
        doc.translation,
        doc.ref,
        doc.bookId,
        doc.canon,
        doc.chapter,
        doc.verse,
        doc.verseEnd ?? null,
        doc.suffix ?? null,
        doc.text,
        doc.ordinal,
        doc.release,
      ]),
    );

    const { rowCount } = await pool.query(
      `INSERT INTO ${TABLES.verses} (${VERSE_INSERT_COLUMNS.join(', ')})
       VALUES ${placeholders}
       ON CONFLICT (id) DO UPDATE SET
         translation  = EXCLUDED.translation,
         reference_id = EXCLUDED.reference_id,
         book_id      = EXCLUDED.book_id,
         canon        = EXCLUDED.canon,
         chapter      = EXCLUDED.chapter,
         verse        = EXCLUDED.verse,
         verse_end    = EXCLUDED.verse_end,
         suffix       = EXCLUDED.suffix,
         text         = EXCLUDED.text,
         ordinal      = EXCLUDED.ordinal,
         release      = EXCLUDED.release`,
      params,
    );

    written += rowCount ?? 0;
  }

  return written;
}

/**
 * Remove verses of this translation belonging to any other release.
 *
 * The manifest's release is authoritative. An earlier version of this sweep
 * compared against a release taken from elsewhere, matched every row it had
 * just written, and emptied the collection — so where that value comes from
 * matters more than it looks.
 */
async function deleteStaleVerses(pool: Pool, manifest: Manifest): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM ${TABLES.verses} WHERE translation = $1 AND release <> $2`,
    [manifest.translation, manifest.release],
  );

  return rowCount ?? 0;
}

/** Record what is loaded, one row per translation release. */
async function upsertTranslation(
  pool: Pool,
  manifest: Manifest,
  registered: boolean,
): Promise<void> {
  await pool.query(
    `INSERT INTO ${TABLES.translations}
       (id, code, name, release, books, book_count, chapter_count, verse_count,
        licence_name, licence_url, rights_holder, source_url, archive_sha256,
        imported_at, available)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), $14)
     ON CONFLICT (id) DO UPDATE SET
       code           = EXCLUDED.code,
       name           = EXCLUDED.name,
       release        = EXCLUDED.release,
       books          = EXCLUDED.books,
       book_count     = EXCLUDED.book_count,
       chapter_count  = EXCLUDED.chapter_count,
       verse_count    = EXCLUDED.verse_count,
       licence_name   = EXCLUDED.licence_name,
       licence_url    = EXCLUDED.licence_url,
       rights_holder  = EXCLUDED.rights_holder,
       source_url     = EXCLUDED.source_url,
       archive_sha256 = EXCLUDED.archive_sha256,
       imported_at    = now(),
       available      = EXCLUDED.available`,
    [
      `${manifest.translation}:${manifest.release}`,
      manifest.translation,
      manifest.translationName,
      manifest.release,
      manifest.books.map((b) => b.bookId),
      manifest.totals.books,
      manifest.totals.chapters,
      manifest.totals.verses,
      manifest.licenceName,
      manifest.licenceUrl,
      manifest.rightsHolder,
      manifest.sourceUrl,
      manifest.archiveSha256,
      // Loading is not permission. Only translations registered in
      // translations.ts may be offered, and isAvailable() is the gate.
      registered,
    ],
  );
}

/**
 * Build retrieval units from loaded verses.
 *
 * Reads from MongoDB rather than the staging tree: units are derived from
 * what is actually being served, so a unit can never describe text the
 * reader does not have.
 *
 * Units carry no vectors. Embedding is a separate stage because it costs
 * money, fails on its own terms, and must not repeat for a unit whose text
 * has not changed.
 */
async function unitsStage(sources: readonly BibleSource[], registeredOnly: boolean): Promise<void> {
  const pool = openPool('Building units', fail);

  try {
    const selected = registeredOnly ? sources.filter((s) => s.registered) : sources;
    log(`Building retrieval units for ${selected.length} translation(s)`);
    log(`Types: ${DERIVABLE_UNIT_TYPES.join(', ')}`);

    for (const source of selected) {
      const code = source.code.toUpperCase();

      const { rows: counted } = await pool.query<{ count: string }>(
        `SELECT count(*) AS count FROM ${TABLES.verses} WHERE translation = $1`,
        [code],
      );
      const loaded = Number(counted[0]?.count ?? 0);

      if (loaded === 0) {
        log(`  ${source.code.padEnd(10)} SKIP (no verses loaded)`);
        continue;
      }

      const { rows: bookRows } = await pool.query<{ book_id: string }>(
        `SELECT DISTINCT book_id FROM ${TABLES.verses}
          WHERE translation = $1
          ORDER BY book_id`,
        [code],
      );

      let written = 0;

      for (const { book_id: bookId } of bookRows) {
        const { rows: bookVerses } = await pool.query<{
          id: string;
          book_id: string;
          chapter: number;
          verse: number;
          suffix: string | null;
          text: string;
          ordinal: string;
          canon: string;
        }>(
          `SELECT id, book_id, chapter, verse, suffix, text, ordinal, canon
             FROM ${TABLES.verses}
            WHERE translation = $1 AND book_id = $2
            ORDER BY ordinal`,
          [code, bookId],
        );

        const byChapter = new Map<number, VerseInput[]>();

        for (const row of bookVerses) {
          const verse: VerseInput = {
            _id: row.id,
            bookId: row.book_id,
            chapter: row.chapter,
            verse: row.verse,
            ...(row.suffix ? { suffix: row.suffix } : {}),
            text: row.text,
            // bigint arrives as a string; leaving it as one would sort
            // lexicographically and scramble verse order.
            ordinal: Number(row.ordinal),
            ...(row.canon ? { canon: row.canon as NonNullable<VerseInput['canon']> } : {}),
          };

          const list = byChapter.get(verse.chapter) ?? [];
          list.push(verse);
          byChapter.set(verse.chapter, list);
        }

        const batch: RetrievalUnit[] = [];

        for (const chapterVerses of byChapter.values()) {
          const canon = (chapterVerses[0]?.canon ?? 'protestant') as NonNullable<
            RetrievalUnit['canon']
          >;
          batch.push(
            ...buildChapterUnits(chapterVerses, {
              translation: code,
              release: source.release,
              canon,
              sourceId: `ebible:${source.ebibleId}`,
            }),
          );
        }

        if (batch.length === 0) continue;

        written += await upsertUnits(pool, batch);
      }

      log(`  ${source.code.padEnd(10)} ${String(written).padStart(7)} units from ${loaded} verses`);
    }

    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM ${RETRIEVAL_TABLE}`,
    );

    log(`\n${Number(rows[0]?.count ?? 0)} retrieval units in ${RETRIEVAL_TABLE}.`);
  } finally {
    await pool.end();
  }
}

/** Columns written per unit, in the order `upsertUnits` supplies them. */
const UNIT_INSERT_COLUMNS = [
  'id',
  'unit_type',
  'translation',
  'book_id',
  'canon',
  'testament',
  'chapter',
  'reference_start',
  'reference_end',
  'text',
  'verse_ids',
  'language',
  'ordinal',
  'source_id',
  'release',
  'text_hash',
] as const;

/**
 * Insert or update retrieval units, preserving existing vectors.
 *
 * The conflict clause names every column **except** `embedding`,
 * `embedding_model` and `embedded_at`. Rebuilding units after an embedding
 * run must not discard work that was paid for per token, and a blanket
 * `SET (...) = (EXCLUDED.*)` would silently null all three — the failure
 * would look like nothing more than an unexpectedly large next embed run.
 *
 * Text that actually changed is still re-embedded: `text_hash` is updated
 * here, and `needsEmbedding` compares it against the stored vector's text.
 */
async function upsertUnits(pool: Pool, units: readonly RetrievalUnit[]): Promise<number> {
  const perBatch = batchSizeFor(UNIT_INSERT_COLUMNS.length);
  let written = 0;

  for (let i = 0; i < units.length; i += perBatch) {
    const batch = units.slice(i, i + perBatch);

    const { placeholders, params } = valuesClause(
      batch.map((unit) => [
        unit._id,
        unit.unitType,
        unit.translation ?? null,
        unit.bookId ?? null,
        unit.canon ?? null,
        unit.testament ?? null,
        unit.chapter ?? null,
        unit.referenceStart ?? null,
        unit.referenceEnd ?? null,
        unit.text,
        unit.verseIds ? [...unit.verseIds] : null,
        unit.language,
        unit.ordinal ?? null,
        unit.sourceId,
        unit.release ?? null,
        unit.textHash ?? null,
      ]),
    );

    const { rowCount } = await pool.query(
      `INSERT INTO ${RETRIEVAL_TABLE} (${UNIT_INSERT_COLUMNS.join(', ')})
       VALUES ${placeholders}
       ON CONFLICT (id) DO UPDATE SET
         unit_type       = EXCLUDED.unit_type,
         translation     = EXCLUDED.translation,
         book_id         = EXCLUDED.book_id,
         canon           = EXCLUDED.canon,
         testament       = EXCLUDED.testament,
         chapter         = EXCLUDED.chapter,
         reference_start = EXCLUDED.reference_start,
         reference_end   = EXCLUDED.reference_end,
         text            = EXCLUDED.text,
         verse_ids       = EXCLUDED.verse_ids,
         language        = EXCLUDED.language,
         ordinal         = EXCLUDED.ordinal,
         source_id       = EXCLUDED.source_id,
         release         = EXCLUDED.release,
         text_hash       = EXCLUDED.text_hash`,
      params,
    );

    written += rowCount ?? 0;
  }

  return written;
}

/**
 * Embed retrieval units that need it.
 *
 * Work is found by querying for units without a current vector, so an
 * interrupted run resumes by being re-run. Nothing whose text and model are
 * unchanged is embedded twice — this costs money per token.
 */
async function embedStage(
  limit: number | undefined,
  force: boolean,
  batchSize: number,
  scope: { books?: readonly string[]; unitType?: string } = {},
): Promise<void> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    fail(
      'Embedding needs VOYAGE_API_KEY in the environment.\n' +
        'Get one at https://dashboard.voyageai.com/organization/api-keys',
    );
  }

  const pool = openPool('Embedding', fail);

  try {
    // Without a scope the embedder works in table order, which for a partial
    // run means one book rather than a useful spread. Narrowing by book or
    // unit type is also how a single correction gets re-embedded without
    // paying for the whole corpus again.
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (scope.books?.length) {
      params.push([...scope.books]);
      conditions.push(`book_id = ANY($${params.length})`);
    }

    if (scope.unitType) {
      params.push(scope.unitType);
      conditions.push(`unit_type = $${params.length}`);
    }

    if (!force) {
      params.push(EMBEDDING_MODEL);
      conditions.push(`(embedding IS NULL OR embedding_model IS DISTINCT FROM $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows: counted } = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM ${RETRIEVAL_TABLE} ${where}`,
      params,
    );
    const outstanding = Number(counted[0]?.count ?? 0);

    if (outstanding === 0) {
      log('Nothing to embed. Every unit has a current vector.');
      return;
    }

    const target = limit ? Math.min(limit, outstanding) : outstanding;
    log(`Embedding ${target} of ${outstanding} unit(s) with ${EMBEDDING_MODEL}`);
    log(`Batch size ${batchSize}, ${EMBEDDING_DIMENSIONS} dimensions`);

    let embedded = 0;
    let tokens = 0;
    const startedAt = Date.now();

    while (embedded < target) {
      const remaining = target - embedded;

      const { rows: batch } = await pool.query<{
        id: string;
        text: string;
        text_hash: string | null;
        embedding_model: string | null;
        has_embedding: boolean;
      }>(
        `SELECT id,
                text,
                text_hash,
                embedding_model,
                embedding IS NOT NULL AS has_embedding
           FROM ${RETRIEVAL_TABLE}
           ${where}
          ORDER BY id
          LIMIT ${Math.min(batchSize, remaining)}`,
        params,
      );

      if (batch.length === 0) break;

      // The query finds units with no vector or an old model, but it does
      // not compare a text hash. A unit whose text changed under an existing
      // vector is caught here instead, and skipping it silently would leave
      // a stale embedding serving current text.
      //
      // The vector itself is deliberately not selected — fetching 1024
      // dimensions per row to ask whether it exists would dominate the
      // query — so `has_embedding` stands in for it.
      const stale = batch.filter(
        (unit) =>
          force ||
          needsEmbedding(
            {
              text: unit.text,
              ...(unit.has_embedding ? { embedding: PRESENT_VECTOR } : {}),
              ...(unit.embedding_model ? { embeddingModel: unit.embedding_model } : {}),
              ...(unit.text_hash ? { textHash: unit.text_hash } : {}),
            },
            EMBEDDING_MODEL,
          ),
      );

      if (stale.length === 0) {
        log(`  ${batch.length} unit(s) already current, nothing to do`);
        break;
      }

      const result = await embedBatch(
        stale.map((unit) => unit.text),
        // Everything stored is a document. A question at query time uses
        // 'query', which Voyage instructs differently.
        'document',
        {
          apiKey,
          // A long rate-limit wait must look like waiting, not hanging.
          onRetry: ({ status, delayMs }) =>
            log(`      ${status} from Voyage; waiting ${(delayMs / 1000).toFixed(0)}s`),
        },
      );

      tokens += result.totalTokens;

      const writes = stale.flatMap((unit, i) => {
        const embedding = result.embeddings[i];
        // embedBatch already checks the count and dimensions, so a gap here
        // would be a logic error rather than a bad response. Skipping beats
        // writing an empty vector that could never match.
        if (!embedding) return [];

        return [[unit.id, toVectorLiteral(embedding)] as const];
      });

      const persisted = await writeVectors(pool, writes);

      // A rejected write must stop the run rather than let the loop report
      // progress and exit zero — which is exactly what a full Atlas cluster
      // produced on the first full run, 24,576 units in.
      if (persisted < writes.length) {
        fail(
          `Wrote ${persisted} of ${writes.length} vectors; Postgres rejected the rest.\n` +
            'Embedding stopped. Re-run once the cause is resolved; completed work is kept.',
        );
      }

      embedded += stale.length;

      const rate = embedded / Math.max(1, (Date.now() - startedAt) / 1000);
      log(
        `  ${String(embedded).padStart(7)} / ${target}  ` +
          `${tokens.toLocaleString()} tokens  ${rate.toFixed(0)}/s`,
      );
    }

    log(`\nEmbedded ${embedded} unit(s), ${tokens.toLocaleString()} tokens.`);

    const { rows: totals } = await pool.query<{ with_vectors: string; total: string }>(
      `SELECT count(*) FILTER (WHERE embedding_model = $1) AS with_vectors,
              count(*)                                    AS total
         FROM ${RETRIEVAL_TABLE}`,
      [EMBEDDING_MODEL],
    );

    log(
      `${Number(totals[0]?.with_vectors ?? 0)} of ${Number(totals[0]?.total ?? 0)} ` +
        `units now carry a ${EMBEDDING_MODEL} vector.`,
    );
  } finally {
    await pool.end();
  }
}

/**
 * Stand-in for a vector that exists but was not fetched.
 *
 * `needsEmbedding` only checks whether a vector is present and non-empty, so
 * a one-element array answers that question without transferring 1024
 * dimensions per row. It is never written anywhere.
 */
const PRESENT_VECTOR: readonly number[] = [0];

/**
 * Write vectors, returning how many rows were updated.
 *
 * `UPDATE ... FROM (VALUES ...)` applies the whole batch in one statement.
 * The cast to halfvec happens in SQL because the driver sends the literal as
 * text, and an untyped parameter would be rejected against a halfvec column.
 */
async function writeVectors(
  pool: Pool,
  writes: readonly (readonly [string, string])[],
): Promise<number> {
  if (writes.length === 0) return 0;

  const { placeholders, params } = valuesClause(writes.map(([id, vector]) => [id, vector]));

  const { rowCount } = await pool.query(
    `UPDATE ${RETRIEVAL_TABLE} AS u
        SET embedding       = v.vector::halfvec,
            embedding_model = $${params.length + 1},
            embedded_at     = now()
       FROM (VALUES ${placeholders}) AS v(id, vector)
      WHERE u.id = v.id`,
    [...params, EMBEDDING_MODEL],
  );

  return rowCount ?? 0;
}

/**
 * Report what each stage has done, without doing any of it.
 *
 * The scripts call this to show state before and after a run, so an operator
 * can see what will happen before committing to it.
 */
async function statusStage(sources: readonly BibleSource[]): Promise<void> {
  const ledger = await openLedger();

  try {
    log('code       staged   uploaded            loaded');

    let staged = 0;
    let uploaded = 0;
    let loaded = 0;

    for (const source of sources) {
      const paths = releasePaths(source.code, source.release);
      const manifestPath = join(STAGING, paths.manifest);

      if (!existsSync(manifestPath)) {
        log(`${source.code.padEnd(10)} -`);
        continue;
      }

      staged += 1;
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;

      const describe = async (stage: IngestStage): Promise<string> => {
        const run = await ledger.read(manifest.translation, manifest.release, stage);
        if (!run) return 'never';
        if (isUpToDate(run, manifest)) {
          if (stage === 'upload') uploaded += 1;
          else loaded += 1;
          return `current`;
        }
        return run.status === 'running' ? 'interrupted' : reasonToRun(run, manifest);
      };

      const up = await describe('upload');
      const ld = await describe('load');

      log(`${source.code.padEnd(10)} yes      ${up.padEnd(19)} ${ld}`);
    }

    log(`
${staged} staged, ${uploaded} uploaded, ${loaded} loaded.`);
  } finally {
    await ledger.close();
  }
}

/**
 * Search retrieval units from the command line.
 *
 * Exists so retrieval quality can be checked without booting the API or
 * writing a throwaway script. A retrieval change that is awkward to test
 * will not be tested.
 */
async function searchStage(args: readonly string[]): Promise<void> {
  const question = args.filter((a) => !a.startsWith('--')).join(' ').trim();

  if (!question) {
    fail('Usage: search "your question" [--translation=BSB] [--type=passage] [--limit=5]');
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) fail('Search needs VOYAGE_API_KEY to embed the question.');

  const flag = (name: string): string | undefined =>
    args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

  const limitFlag = Number.parseInt(flag('limit') ?? '', 10);

  const pool = openPool('Search', fail);

  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM ${RETRIEVAL_TABLE} WHERE embedding_model = $1`,
      [EMBEDDING_MODEL],
    );
    const embedded = Number(rows[0]?.count ?? 0);

    if (embedded === 0) {
      fail('No units carry a vector yet. Run the embed stage first.');
    }

    const hits = await searchUnits(pool, question, {
      apiKey,
      ...(flag('translation') ? { translation: flag('translation') as string } : {}),
      ...(flag('type') ? { unitType: flag('type') as RetrievalUnit['unitType'] } : {}),
      ...(flag('book') ? { bookId: flag('book') as string } : {}),
      ...(Number.isFinite(limitFlag) ? { limit: limitFlag } : {}),
    });

    log(`"${question}"`);
    log(`${embedded.toLocaleString()} units searchable\n`);

    if (hits.length === 0) {
      log('No results. Try widening the filters, or embed more units.');
      return;
    }

    for (const hit of hits) {
      const reference = formatRange(hit) || hit._id;
      log(`  ${hit.score.toFixed(3)}  ${reference}  [${hit.unitType}]`);
      log(`         ${hit.text.slice(0, 160)}${hit.text.length > 160 ? '...' : ''}`);
      log('');
    }
  } finally {
    await pool.end();
  }
}

/**
 * Report on the vector index.
 *
 * The index itself is created by migration 0002, not here: it is schema, and
 * schema belongs in a migration that can be reviewed, ordered and rolled
 * back. This command reports what exists so a slow search can be diagnosed
 * without opening psql.
 */
async function vectorIndexCommand(): Promise<void> {
  const pool = openPool('Inspecting the index', fail);

  try {
    log('Vector index');
    log('');
    log(`  table       ${RETRIEVAL_TABLE}`);
    log(`  index       ${VECTOR_INDEX_NAME}`);
    log(`  model       ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dimensions, fixed)`);
    log('');

    const { rows: indexes } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = $1 AND indexname = $2`,
      [RETRIEVAL_TABLE, VECTOR_INDEX_NAME],
    );

    const definition = indexes[0]?.indexdef;

    if (!definition) {
      fail(
        `${VECTOR_INDEX_NAME} does not exist.\n` +
          'Run the migrations: pnpm --filter @scrinode/api migrate',
      );
    }

    log(`  ${definition}`);
    log('');

    // Index size is the number that decides whether it stays in RAM, which
    // is the difference between a fast search and a disk-bound one.
    const { rows: stats } = await pool.query<{
      index_size: string;
      table_size: string;
      embedded: string;
      total: string;
    }>(
      `SELECT pg_size_pretty(pg_relation_size($2))                    AS index_size,
              pg_size_pretty(pg_total_relation_size($1))              AS table_size,
              count(*) FILTER (WHERE embedding IS NOT NULL)::text     AS embedded,
              count(*)::text                                          AS total
         FROM ${RETRIEVAL_TABLE}`,
      [RETRIEVAL_TABLE, VECTOR_INDEX_NAME],
    );

    const row = stats[0];

    if (row) {
      log(`  index size  ${row.index_size}`);
      log(`  table size  ${row.table_size}`);
      log(`  embedded    ${Number(row.embedded).toLocaleString()} of ${Number(row.total).toLocaleString()}`);
    }

    log('');
    log(`  ef_search   ${HNSW_EF_SEARCH} (per query; raise for recall, lower for speed)`);
    log('');
    log('The column width is fixed at the model\'s dimensions. Changing the model');
    log('means a migration altering the column and re-embedding every row.');
  } finally {
    await pool.end();
  }
}

function listStage(): void {
  log('code       ebible id        registered  canon                    name');
  for (const source of BIBLE_SOURCES) {
    log(
      `${source.code.padEnd(10)} ${source.ebibleId.padEnd(16)} ` +
        `${source.registered ? 'yes       ' : 'no        '}  ` +
        `${source.canons.join('+').padEnd(24)} ${source.name}`,
    );
  }
  log(`\n${BIBLE_SOURCES.length} sources, ${BIBLE_SOURCES.filter((s) => s.registered).length} registered.`);
}

// --- entry point ----------------------------------------------------------

async function main(): Promise<void> {
  const [command = '', ...rest] = process.argv.slice(2);

  // Printed for any command that needs configuration, so a run picking up
  // the wrong file — or none — is visible rather than surfacing later as a
  // confusing "variable not set".
  if (command && command !== 'list' && command !== 'help') {
    log(DOTENV_PATH ? `Loaded ${DOTENV_PATH}` : 'No .env found; using the ambient environment.');
  }
  const force = rest.includes('--force');
  const all = rest.includes('--all');

  // Resolved lazily. Only some commands take translation codes; `search`
  // takes a question, and resolving eagerly rejected it as an unknown
  // translation before the command ever ran.
  const sources = (): readonly BibleSource[] => selectSources(rest);

  switch (command) {
    case 'list':
      return listStage();
    case 'status':
      return statusStage(sources());
    case 'vector-index':
      return vectorIndexCommand();
    case 'search':
      return searchStage(rest);
    case 'units':
      return unitsStage(sources(), !all);
    case 'embed': {
      const numeric = (flag: string): number => {
        const found = rest.find((a) => a.startsWith(`${flag}=`));
        return found ? Number.parseInt(found.split('=')[1] ?? '', 10) : Number.NaN;
      };

      const limitValue = numeric('--limit');
      const batchValue = numeric('--batch');

      const books = rest
        .find((a) => a.startsWith('--books='))
        ?.split('=')[1]
        ?.split(',')
        .map((b) => b.trim().toUpperCase())
        .filter(Boolean);

      const type = rest.find((a) => a.startsWith('--type='))?.split('=')[1];

      return embedStage(
        Number.isFinite(limitValue) ? limitValue : undefined,
        force,
        Number.isFinite(batchValue) ? batchValue : EMBED_BATCH_SIZE,
        {
          ...(books?.length ? { books } : {}),
          ...(type ? { unitType: type } : {}),
        },
      );
    }
    case 'fetch':
      return fetchStage(sources(), force);
    case 'parse':
      return parseStage(sources());
    case 'upload':
      return uploadStage(sources(), force);
    case 'load':
      return loadStage(sources(), !all, force);
    case 'all':
      await fetchStage(sources(), force);
      await parseStage(sources());
      return;
    default:
      log(
        [
          'Usage: scrinode-ingest <command> [translations...] [flags]',
          '',
          'Commands:',
          '  list                 show every source and whether it is registered',
          '  status [codes]       what has been uploaded and loaded, without doing it',
          '  vector-index         print the vector index definition  (--create applies it)',
          '  units [codes]        build retrieval units from loaded verses  (--all)',
          '  embed                embed units  (--limit=N, --batch=N, --books=GEN,ROM, --type=passage, --force)',
          '  search "question"    vector search  (--translation=, --type=, --book=, --limit=)',
          '  fetch [codes]        download publisher archives   (--force re-downloads)',
          '  parse [codes]        USFM to verse JSON + manifests',
          '  upload [codes]       staging tree to DigitalOcean Spaces  (--force re-uploads)',
          '  load [codes]         verse rows into Postgres  (--all, --force)',
          '  all [codes]          fetch then parse',
          '',
          'With no codes, every source is processed.',
          '',
          'Environment:',
          '  INGEST_DIR           staging directory (default .ingest)',
          '  DO_SPACES_ENDPOINT   e.g. https://fra1.digitaloceanspaces.com',
          '  DO_SPACES_BUCKET     Spaces bucket name',
          '  DO_SPACES_REGION     e.g. fra1 (default us-east-1)',
          '  DO_SPACES_KEY        access key',
          '  DO_SPACES_SECRET     secret key',
          '  DATABASE_URL         postgres connection string',
          '  DATABASE_SSL         true to require TLS (default false)',
          '  VOYAGE_API_KEY       embeddings key, for the embed stage',
        ].join('\n'),
      );
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
