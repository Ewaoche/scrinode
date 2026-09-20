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
import { COLLECTIONS, VERSE_INDEXES, type VerseDocument } from './documents.js';
import {
  DERIVABLE_UNIT_TYPES,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  RETRIEVAL_COLLECTION,
  VECTOR_INDEX_NAME,
  vectorIndexDefinition,
  type RetrievalUnit,
} from './retrieval.js';
import { buildChapterUnits, needsEmbedding, type VerseInput } from './units.js';
import { EMBED_BATCH_SIZE, embedBatch } from './voyage.js';
import { formatRange, searchUnits } from './search.js';
import {
  LEDGER_COLLECTION,
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
 *   load    verse documents into MongoDB
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
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Tracking needs MONGODB_URI in the environment.');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  await client.connect();

  const collection = client
    .db(process.env.MONGODB_DB ?? 'scrinode')
    .collection<IngestRun>(LEDGER_COLLECTION);

  const host = process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'unknown';

  return {
    read: (translation, release, stage) =>
      collection.findOne({ _id: runId(translation, release, stage) }),

    begin: async (manifest, stage) => {
      const id = runId(manifest.translation, manifest.release, stage);
      await collection.replaceOne(
        { _id: id },
        {
          translation: manifest.translation,
          release: manifest.release,
          stage,
          archiveSha256: manifest.archiveSha256,
          status: 'running',
          startedAt: new Date(),
          host,
        },
        { upsert: true },
      );
    },

    finish: async (manifest, stage, counts) => {
      await collection.updateOne(
        { _id: runId(manifest.translation, manifest.release, stage) },
        { $set: { status: 'completed', completedAt: new Date(), ...counts } },
      );
    },

    markFailed: async (manifest, stage, error) => {
      await collection.updateOne(
        { _id: runId(manifest.translation, manifest.release, stage) },
        { $set: { status: 'failed', completedAt: new Date(), error } },
      );
    },

    close: () => client.close(),
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
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Load needs MONGODB_URI in the environment.');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  const ledger = await openLedger();

  let loaded = 0;
  let skipped = 0;

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? 'scrinode');
    const verses = db.collection<VerseDocument>(COLLECTIONS.verses);

    for (const index of VERSE_INDEXES) {
      await verses.createIndex(index.key, { name: index.name });
    }

    const selected = registeredOnly ? sources.filter((s) => s.registered) : sources;
    log(`Loading ${selected.length} translation(s) into MongoDB`);

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

      try {
        // One book at a time: a whole Bible of verse documents is large
        // enough that a single bulk write risks memory and a long lock.
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
          // the two disagree, documents would be written under one release
          // and then deleted by the stale sweep below, which expects the
          // other.
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

          // Upserts keyed on the deterministic _id, so a re-run repairs
          // rather than duplicates and a partial failure is safe to resume.
          await verses.bulkWrite(
            documents.map((doc) => ({
              replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
            })),
            { ordered: false },
          );

          written += documents.length;
        }

        // Verses from an earlier release of the same translation that this
        // release no longer contains. Left behind they would be served as
        // current text.
        const stale = await verses.deleteMany({
          translation: manifest.translation as VerseDocument['translation'],
          release: { $ne: manifest.release },
        });

        await db.collection<{ _id: string }>(COLLECTIONS.translations).replaceOne(
          { _id: `${manifest.translation}:${manifest.release}` },
          {
            code: manifest.translation,
            name: manifest.translationName,
            release: manifest.release,
            books: manifest.books.map((b) => b.bookId),
            bookCount: manifest.totals.books,
            chapterCount: manifest.totals.chapters,
            verseCount: manifest.totals.verses,
            licenceName: manifest.licenceName,
            licenceUrl: manifest.licenceUrl,
            rightsHolder: manifest.rightsHolder,
            sourceUrl: manifest.sourceUrl,
            archiveSha256: manifest.archiveSha256,
            importedAt: new Date(),
            // Loading is not permission. Only translations registered in
            // translations.ts may be offered, and isAvailable() is the gate.
            available: source.registered,
          },
          { upsert: true },
        );

        await ledger.finish(manifest, 'load', {
          verseCount: written,
          bookCount: manifest.totals.books,
        });

        loaded += 1;
        log(
          `  ${source.code.padEnd(10)} ${String(written).padStart(6)} verses` +
            (stale.deletedCount > 0 ? `  (${stale.deletedCount} stale removed)` : '') +
            `  (${reasonToRun(previous, manifest)})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await ledger.markFailed(manifest, 'load', message);
        log(`  ${source.code.padEnd(10)} FAILED  ${message}`);
        throw error;
      }
    }

    log(`
${loaded} loaded, ${skipped} already current.`);
  } finally {
    await ledger.close();
    await client.close();
  }
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
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Building units needs MONGODB_URI in the environment.');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? 'scrinode');
    const verses = db.collection<VerseInput & { translation: string }>(COLLECTIONS.verses);
    const units = db.collection<RetrievalUnit>(RETRIEVAL_COLLECTION);

    // Finding unembedded work must not scan the collection.
    await units.createIndex({ embeddingModel: 1, unitType: 1 }, { name: 'model_type' });
    await units.createIndex({ translation: 1, unitType: 1 }, { name: 'translation_type' });

    const selected = registeredOnly ? sources.filter((s) => s.registered) : sources;
    log(`Building retrieval units for ${selected.length} translation(s)`);
    log(`Types: ${DERIVABLE_UNIT_TYPES.join(', ')}`);

    for (const source of selected) {
      const code = source.code.toUpperCase();
      const loaded = await verses.countDocuments({ translation: code });

      if (loaded === 0) {
        log(`  ${source.code.padEnd(10)} SKIP (no verses loaded)`);
        continue;
      }

      const books = (await verses.distinct('bookId', { translation: code })).sort();
      let written = 0;

      for (const bookId of books) {
        const bookVerses = await verses
          .find({ translation: code, bookId })
          .sort({ ordinal: 1 })
          .toArray();

        const byChapter = new Map<number, VerseInput[]>();
        for (const verse of bookVerses) {
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

        // $set leaves unnamed fields alone, so rebuilding units after an
        // embedding run keeps their vectors.
        await units.bulkWrite(
          batch.map((unit) => ({
            updateOne: { filter: { _id: unit._id }, update: { $set: unit }, upsert: true },
          })),
          { ordered: false },
        );

        written += batch.length;
      }

      log(`  ${source.code.padEnd(10)} ${String(written).padStart(7)} units from ${loaded} verses`);
    }

    const total = await units.countDocuments();
    log(`\n${total} retrieval units in ${RETRIEVAL_COLLECTION}.`);
  } finally {
    await client.close();
  }
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
): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Embedding needs MONGODB_URI in the environment.');

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    fail(
      'Embedding needs VOYAGE_API_KEY in the environment.\n' +
        'Get one at https://dashboard.voyageai.com/organization/api-keys',
    );
  }

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB ?? 'scrinode');
    const units = db.collection<RetrievalUnit>(RETRIEVAL_COLLECTION);

    const pending = force
      ? {}
      : {
          $or: [{ embedding: { $exists: false } }, { embeddingModel: { $ne: EMBEDDING_MODEL } }],
        };

    const outstanding = await units.countDocuments(pending);
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
      const batch = await units
        .find(pending)
        .limit(Math.min(batchSize, remaining))
        .toArray();

      if (batch.length === 0) break;

      // The Mongo query finds units with no vector or an old model, but it
      // cannot compare a text hash. A unit whose text changed under an
      // existing vector is caught here instead, and skipping it silently
      // would leave a stale embedding serving current text.
      const stale = batch.filter((unit) => force || needsEmbedding(unit, EMBEDDING_MODEL));

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
        // writing an empty vector the index would silently reject.
        if (!embedding) return [];

        return [
          {
            updateOne: {
              filter: { _id: unit._id },
              update: {
                $set: {
                  embedding,
                  embeddingModel: EMBEDDING_MODEL,
                  embeddedAt: new Date(),
                },
              },
            },
          },
        ];
      });

      await units.bulkWrite(writes, { ordered: false });

      embedded += stale.length;

      const rate = embedded / Math.max(1, (Date.now() - startedAt) / 1000);
      log(
        `  ${String(embedded).padStart(7)} / ${target}  ` +
          `${tokens.toLocaleString()} tokens  ${rate.toFixed(0)}/s`,
      );
    }

    log(`\nEmbedded ${embedded} unit(s), ${tokens.toLocaleString()} tokens.`);

    const withVectors = await units.countDocuments({ embeddingModel: EMBEDDING_MODEL });
    const total = await units.countDocuments();
    log(`${withVectors} of ${total} units now carry a ${EMBEDDING_MODEL} vector.`);
  } finally {
    await client.close();
  }
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

  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Search needs MONGODB_URI in the environment.');

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) fail('Search needs VOYAGE_API_KEY to embed the question.');

  const flag = (name: string): string | undefined =>
    args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

  const limitFlag = Number.parseInt(flag('limit') ?? '', 10);

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const units = client
      .db(process.env.MONGODB_DB ?? 'scrinode')
      .collection<RetrievalUnit>(RETRIEVAL_COLLECTION);

    const embedded = await units.countDocuments({ embeddingModel: EMBEDDING_MODEL });
    if (embedded === 0) {
      fail('No units carry a vector yet. Run the embed stage first.');
    }

    const hits = await searchUnits(units, question, {
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
    await client.close();
  }
}

/**
 * Show, or create, the Atlas Vector Search index.
 *
 * The driver can create vector indexes directly, so `--create` avoids
 * copying JSON into the Atlas UI and the transcription errors that invites.
 * Without it the definition is printed, which is still useful for review and
 * for anyone working through the UI.
 *
 * Either way the definition comes from the same constants the embedder uses,
 * so `numDimensions` cannot drift from the model.
 */
async function vectorIndexCommand(create: boolean): Promise<void> {
  const definition = vectorIndexDefinition();

  if (!create) {
    printVectorIndex(definition);
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Creating the index needs MONGODB_URI in the environment.');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const collection = client
      .db(process.env.MONGODB_DB ?? 'scrinode')
      .collection(RETRIEVAL_COLLECTION);

    // The driver types this loosely; these are the fields Atlas returns and
    // the only ones read here.
    type SearchIndexInfo = { name: string; status?: string; queryable?: boolean };

    const listIndexes = async (): Promise<SearchIndexInfo[]> =>
      (await collection.listSearchIndexes().toArray()) as SearchIndexInfo[];

    const existing = await listIndexes();
    const already = existing.find((index) => index.name === VECTOR_INDEX_NAME);

    if (already) {
      log(`${VECTOR_INDEX_NAME} already exists (${already.status ?? 'unknown'}).`);
      log('Atlas does not allow changing numDimensions in place. To change it,');
      log('drop the index in the Atlas UI and re-run this command.');
      return;
    }

    await collection.createSearchIndex({
      name: VECTOR_INDEX_NAME,
      type: 'vectorSearch',
      definition,
    });

    log(`Created ${VECTOR_INDEX_NAME} on ${RETRIEVAL_COLLECTION}.`);

    // Atlas builds asynchronously; a PENDING index answers no queries, so
    // waiting here means the next stage can rely on it.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const [index] = await listIndexes();
      if (!index) break;

      if (index.status === 'READY') {
        log(`Status READY, queryable.`);
        return;
      }

      if (index.status === 'FAILED') {
        fail(`Atlas reported the index build FAILED: ${JSON.stringify(index)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    log('Still building. Check the Atlas UI; it will become queryable shortly.');
  } finally {
    await client.close();
  }
}

function printVectorIndex(definition: object): void {
  log('Atlas Vector Search index');
  log('');
  log(`  database    ${process.env.MONGODB_DB ?? 'scrinode'}`);
  log(`  collection  ${RETRIEVAL_COLLECTION}`);
  log(`  index name  ${VECTOR_INDEX_NAME}`);
  log(`  model       ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dimensions, fixed)`);
  log('');
  log('Atlas UI: Atlas Search -> Create Search Index -> Vector Search -> JSON Editor');
  log('');
  log(JSON.stringify(definition, null, 2));
  log('');
  log('numDimensions must match the model exactly. Changing it later requires');
  log('dropping the index and re-embedding every document.');
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
      return vectorIndexCommand(rest.includes('--create'));
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

      return embedStage(
        Number.isFinite(limitValue) ? limitValue : undefined,
        force,
        Number.isFinite(batchValue) ? batchValue : EMBED_BATCH_SIZE,
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
          '  embed                embed units that need it  (--limit=N, --batch=N, --force)',
          '  search "question"    vector search  (--translation=, --type=, --book=, --limit=)',
          '  fetch [codes]        download publisher archives   (--force re-downloads)',
          '  parse [codes]        USFM to verse JSON + manifests',
          '  upload [codes]       staging tree to DigitalOcean Spaces  (--force re-uploads)',
          '  load [codes]         verse documents into MongoDB  (--all, --force)',
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
          '  MONGODB_URI          connection string',
          '  MONGODB_DB           database name (default scrinode)',
          '  VOYAGE_API_KEY       embeddings key, for the embed stage',
        ].join('\n'),
      );
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
