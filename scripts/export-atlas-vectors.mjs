import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Export embedded vectors from MongoDB Atlas.
 *
 * A one-shot migration aid, driven by Export-AtlasVectors.ps1. Read-only.
 *
 * The mongodb driver is no longer a workspace dependency; this resolves it
 * from wherever it still exists in the pnpm store and explains itself if it
 * is gone.
 */
const require = createRequire(import.meta.url);

let MongoClient;

try {
  ({ MongoClient } = require('mongodb'));
} catch {
  console.error(
    'The mongodb driver is no longer installed.\n' +
      '\n' +
      'It was removed when Scrinode moved to Postgres. To run this export:\n' +
      '  pnpm add -w -D mongodb\n' +
      '  ... run the export ...\n' +
      '  pnpm remove -w mongodb\n',
  );
  process.exit(1);
}

const uri = process.env.ATLAS_URI;
const database = process.env.ATLAS_DB ?? 'scrinode_dev';
const output = process.env.EXPORT_PATH;

if (!uri || !output) {
  console.error('ATLAS_URI and EXPORT_PATH are required. Run Export-AtlasVectors.ps1 instead.');
  process.exit(1);
}

await mkdir(dirname(output), { recursive: true });

const client = new MongoClient(uri);
const stream = createWriteStream(output, { encoding: 'utf8' });

let exported = 0;

try {
  await client.connect();

  const units = client.db(database).collection('retrieval_units');

  // Only rows carrying a vector. Everything else is rebuilt from the staging
  // tree for free, and exporting it would bloat the file for no gain.
  const cursor = units.find(
    { embedding: { $exists: true } },
    { projection: { _id: 1, embedding: 1, embeddingModel: 1, textHash: 1 } },
  );

  for await (const unit of cursor) {
    // BinData subtype 9 holds float32; toFloat32Array gives the values back
    // exactly. Written as plain numbers so the file does not depend on BSON
    // to be readable.
    const vector = unit.embedding?.buffer
      ? Array.from(unit.embedding.toFloat32Array())
      : Array.from(unit.embedding ?? []);

    if (vector.length === 0) continue;

    const line = JSON.stringify({
      id: unit._id,
      model: unit.embeddingModel,
      textHash: unit.textHash,
      vector,
    });

    // Backpressure matters: ~5,600 vectors at 1024 dimensions is a few
    // hundred megabytes of JSON, and ignoring `write`'s return value would
    // buffer all of it in memory.
    if (!stream.write(line + '\n')) {
      await new Promise((resolve) => stream.once('drain', resolve));
    }

    exported += 1;

    if (exported % 1000 === 0) {
      process.stdout.write(`  ${exported} exported\n`);
    }
  }

  await new Promise((resolve, reject) => {
    stream.end((error) => (error ? reject(error) : resolve()));
  });

  console.log(`  ${exported} vectors exported`);

  if (exported === 0) {
    console.log('\nNothing was embedded on this cluster, or the database name is wrong.');
  }
} finally {
  await client.close();
}
