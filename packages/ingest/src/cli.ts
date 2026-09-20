#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fromBuffer } from 'yauzl';
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

async function uploadStage(sources: readonly BibleSource[]): Promise<void> {
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

  log(`Uploading ${sources.length} release(s) to ${bucket}`);

  for (const source of sources) {
    const paths = releasePaths(source.code, source.release);
    const manifestPath = join(STAGING, paths.manifest);

    if (!existsSync(manifestPath)) {
      log(`  ${source.code.padEnd(10)} SKIP (not parsed)`);
      continue;
    }

    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
    let count = 0;

    await put(paths.archive, await readFile(join(STAGING, paths.archive)), 'application/zip');
    await put(paths.manifest, Buffer.from(JSON.stringify(manifest)), 'application/json');
    await put(paths.index, await readFile(join(STAGING, paths.index)), 'application/json');
    count += 3;

    for (const book of manifest.books) {
      await put(paths.usfm(book.bookId), await readFile(join(STAGING, paths.usfm(book.bookId))), 'text/plain');
      await put(paths.json(book.bookId), await readFile(join(STAGING, paths.json(book.bookId))), 'application/json');
      count += 2;
    }

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

    log(`  ${source.code.padEnd(10)} ${count + 1} objects`);
  }
}

async function loadStage(sources: readonly BibleSource[], registeredOnly: boolean): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('Load needs MONGODB_URI in the environment.');

  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);

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
      let written = 0;

      // One book at a time: a whole Bible of verse documents is large enough
      // that a single bulk write risks memory and a long lock.
      for (const book of manifest.books) {
        const parsed = JSON.parse(
          await readFile(join(STAGING, paths.json(book.bookId)), 'utf8'),
        ) as { bookId: string; verses: { chapter: number; verse: number; verseEnd: number; text: string }[] };

        const documents = toVerseDocuments(source.code, source.release, [
          {
            book: { bookId: parsed.bookId, verses: parsed.verses },
            canon: book.canon,
            name: book.name,
            order: 0,
            chapters: book.chapters,
            sha256: book.sha256,
          },
        ]);

        if (documents.length === 0) continue;

        // Upserts keyed on the deterministic _id, so a re-run repairs rather
        // than duplicates and a partial failure is safe to resume.
        await verses.bulkWrite(
          documents.map((doc) => ({
            replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
          })),
          { ordered: false },
        );

        written += documents.length;
      }

      await db.collection<{ _id: string }>(COLLECTIONS.translations).replaceOne(
        { _id: `${manifest.translation}:${manifest.release}` },
        {
          _id: `${manifest.translation}:${manifest.release}`,
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
          available: source.registered,
        },
        { upsert: true },
      );

      log(`  ${source.code.padEnd(10)} ${written} verses`);
    }
  } finally {
    await client.close();
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
  const force = rest.includes('--force');
  const all = rest.includes('--all');
  const sources = selectSources(rest);

  switch (command) {
    case 'list':
      return listStage();
    case 'fetch':
      return fetchStage(sources, force);
    case 'parse':
      return parseStage(sources);
    case 'upload':
      return uploadStage(sources);
    case 'load':
      return loadStage(sources, !all);
    case 'all':
      await fetchStage(sources, force);
      await parseStage(sources);
      return;
    default:
      log(
        [
          'Usage: scrinode-ingest <command> [translations...] [flags]',
          '',
          'Commands:',
          '  list                 show every source and whether it is registered',
          '  fetch [codes]        download publisher archives   (--force re-downloads)',
          '  parse [codes]        USFM to verse JSON + manifests',
          '  upload [codes]       staging tree to DigitalOcean Spaces',
          '  load [codes]         verse documents into MongoDB  (--all includes unregistered)',
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
        ].join('\n'),
      );
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
