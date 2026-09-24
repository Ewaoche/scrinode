import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Client } from 'pg';

/**
 * Import vectors exported from Atlas into Postgres.
 *
 * A one-shot migration aid. Pairs with export-atlas-vectors.mjs.
 *
 * Only updates rows that already exist: the units themselves are rebuilt
 * from the staging tree by `cli.js units`, which must have been run first.
 * A vector without its unit has nothing to attach to, and inserting a
 * skeleton row to hold one would leave a unit with no text.
 */
const input = process.env.IMPORT_PATH;
const connectionString = process.env.DATABASE_URL;

if (!input || !connectionString) {
  console.error('IMPORT_PATH and DATABASE_URL are required. Run Import-AtlasVectors.ps1 instead.');
  process.exit(1);
}

const client = new Client({ connectionString });

let read = 0;
let applied = 0;
let missing = 0;
let stale = 0;

try {
  await client.connect();

  const lines = createInterface({
    input: createReadStream(input, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;

    read += 1;

    const { id, model, textHash, vector } = JSON.parse(line);

    // The text may have changed since the vector was made — a parser fix, a
    // re-fetched release. Importing a vector for text that no longer matches
    // would serve a stale embedding as current, which is worse than paying
    // to re-embed. The unit is left unembedded so the embedder finds it.
    const { rowCount } = await client.query(
      `UPDATE retrieval_units
          SET embedding       = $2::halfvec,
              embedding_model = $3,
              embedded_at     = now()
        WHERE id = $1
          AND text_hash IS NOT DISTINCT FROM $4`,
      [id, `[${vector.join(',')}]`, model, textHash],
    );

    if (rowCount > 0) {
      applied += 1;
    } else {
      // Distinguish "no such unit" from "text changed": the first means the
      // units stage has not run, the second is expected and benign.
      const { rows } = await client.query('SELECT 1 FROM retrieval_units WHERE id = $1', [id]);
      if (rows.length === 0) missing += 1;
      else stale += 1;
    }

    if (read % 1000 === 0) {
      process.stdout.write(`  ${read} read, ${applied} applied\n`);
    }
  }

  console.log(`\n  read     ${read}`);
  console.log(`  applied  ${applied}`);
  console.log(`  stale    ${stale}   (text changed; will be re-embedded)`);
  console.log(`  missing  ${missing}   (no such unit)`);

  if (missing > 0) {
    console.log(
      '\nUnits are missing. Run `node packages/ingest/dist/cli.js units` first,\n' +
        'then re-run this import.',
    );
  }
} finally {
  await client.end();
}
