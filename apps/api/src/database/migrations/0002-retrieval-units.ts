import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * Retrieval units and their vector index.
 *
 * This replaces Atlas Vector Search. §20 requires multiple retrieval unit
 * types rather than isolated verses, and §19 requires filtered vector search
 * as one half of hybrid retrieval — so the filter columns are part of the
 * table rather than an afterthought.
 *
 * Kept separate from the baseline schema because it is the one migration
 * whose cost scales with corpus size: the HNSW build is the expensive step,
 * and separating it means the relational schema can be rolled back without
 * discarding an index that takes minutes to rebuild.
 */

/**
 * Embedding dimensions.
 *
 * Must match `EMBEDDING_DIMENSIONS` in `@scrinode/ingest`. Duplicated as a
 * literal rather than imported: a migration records what the schema was when
 * it ran, and must not change meaning later because a constant moved. The
 * ingest package asserts the two agree, so drift fails a test rather than
 * silently producing a dimension mismatch at insert time.
 */
const EMBEDDING_DIMENSIONS = 1024;

export const migration0002: Migration = {
  version: 2,
  name: 'retrieval-units',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE retrieval_units (
        -- Deterministic, so rebuilding units is idempotent and a re-run
        -- after a failure produces no duplicates.
        id               text    PRIMARY KEY,
        unit_type        text    NOT NULL,

        -- Filters. Every one answers a question the reader or Zedek will
        -- actually ask; nullable because not every unit type is tied to a
        -- translation or a book (a lexical entry is neither).
        translation      text,
        book_id          text,
        canon            text,
        testament        text,
        chapter          integer,

        -- Canonical reference bounds, e.g. PHP.4.10 to PHP.4.20.
        reference_start  text,
        reference_end    text,

        -- The text that gets embedded and shown as a result.
        text             text    NOT NULL,
        -- Verses covered, so a hit can be expanded to its source verses.
        verse_ids        text[],
        language         text    NOT NULL DEFAULT 'en',
        ordinal          bigint,

        -- Provenance (§21).
        source_id        text    NOT NULL,
        release          text,

        -- The vector.
        --
        -- halfvec rather than vector: 16-bit floats halve both storage and
        -- index memory, and at 1024 dimensions the recall difference is
        -- negligible — comparable to the scalar quantization Atlas was
        -- already applying. It also raises pgvector's indexable ceiling from
        -- 2,000 dimensions to 4,000, leaving room for a larger model without
        -- a storage-type migration.
        --
        -- Null until embedded, which is how the embedder finds work to do.
        embedding        halfvec(${EMBEDDING_DIMENSIONS}),
        embedding_model  text,
        embedded_at      timestamptz,
        -- SHA256 of text, so an edit is detectable without comparing vectors.
        text_hash        text,

        CONSTRAINT retrieval_units_canon_valid
          CHECK (canon IS NULL OR canon IN ('protestant', 'deuterocanonical')),
        CONSTRAINT retrieval_units_testament_valid
          CHECK (testament IS NULL OR testament IN ('OT', 'NT')),

        -- A vector without the model that produced it is unusable: vectors
        -- from different models occupy unrelated spaces, and mixing them
        -- yields scores that mean nothing.
        CONSTRAINT retrieval_units_embedding_has_model
          CHECK (embedding IS NULL OR embedding_model IS NOT NULL)
      )
    `);

    // The vector index.
    //
    // HNSW rather than IVFFlat: it needs no training pass over existing data,
    // so it can be built on an empty table and stay correct as units arrive.
    // IVFFlat built on an empty table would have to be rebuilt after loading.
    //
    // Cosine distance matches how Voyage embeddings are trained and how the
    // Atlas index was configured, so measured score thresholds carry over.
    //
    // m and ef_construction are pgvector's defaults, stated explicitly
    // because they are the knobs that trade build time against recall and
    // should be visible when tuning.
    await client.query(`
      CREATE INDEX retrieval_units_embedding_idx
        ON retrieval_units
        USING hnsw (embedding halfvec_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `);

    // Filter indexes.
    //
    // HNSW applies filters after traversing the graph, so a narrow filter can
    // exhaust the candidate list before finding enough matches. These B-tree
    // indexes let the planner choose a filtered scan instead when the filter
    // is selective enough to win.
    await client.query(`
      CREATE INDEX retrieval_units_filters_idx
        ON retrieval_units (translation, unit_type, book_id)
    `);

    await client.query(`
      CREATE INDEX retrieval_units_model_idx
        ON retrieval_units (embedding_model)
    `);

    // Finding work: units that have no vector, or whose vector came from a
    // superseded model. Partial, because once the corpus is embedded this
    // index stays small while the table does not.
    await client.query(`
      CREATE INDEX retrieval_units_unembedded_idx
        ON retrieval_units (unit_type, book_id)
        WHERE embedding IS NULL
    `);

    // Replacing one release without touching the rest.
    await client.query(`
      CREATE INDEX retrieval_units_release_idx
        ON retrieval_units (translation, release)
    `);

    // --- ingestion ledger ---------------------------------------------------

    // Idempotency for the ingestion pipeline: a run is skipped when the
    // manifest hash already recorded matches the archive on disk (§22.3).
    await client.query(`
      CREATE TABLE ingest_runs (
        id              text        PRIMARY KEY,
        translation     text        NOT NULL,
        release         text        NOT NULL,
        stage           text        NOT NULL,
        manifest_sha256 text        NOT NULL,
        verse_count     integer,
        unit_count      integer,
        started_at      timestamptz NOT NULL DEFAULT now(),
        completed_at    timestamptz,
        error           text
      )
    `);

    await client.query(`
      CREATE INDEX ingest_runs_translation_idx
        ON ingest_runs (translation, stage, started_at DESC)
    `);
  },

  async down(client: PoolClient): Promise<void> {
    // Dropping the table drops its indexes with it.
    await client.query('DROP TABLE IF EXISTS ingest_runs');
    await client.query('DROP TABLE IF EXISTS retrieval_units');
  },
};
