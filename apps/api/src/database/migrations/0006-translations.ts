import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * The `translations` table — the per-release record of what was ingested.
 *
 * Missing entirely: the ingestion CLI upserts it on every `load`, and no
 * migration created it, so `load` failed with
 *
 *   relation "translations" does not exist
 *
 * after migration 0005 unblocked the ledger. Both gaps date from the
 * MongoDB-to-Postgres port, where collections were created implicitly on
 * first write and a missing one was not an error. In Postgres it is, which is
 * the behaviour worth having (§24).
 *
 * This is **provenance**, which AGENTS.md §21 makes a first-class
 * requirement: every imported source records its licence, rights holder,
 * origin URL and the SHA256 of the publisher's archive. §22.3 adds why the
 * hash matters — it proves the bytes are the ones whose licence was verified,
 * and it allows re-parsing without returning to the publisher.
 *
 * Distinct from `sources` (migration 0001), which describes a *kind* of
 * source — a lexicon, a cross-reference dataset. This describes one release
 * of one Bible translation, keyed `CODE:release`, so re-importing a later
 * release is a new row rather than an overwrite. §22.3 requires exactly that:
 * a verse that changes silently under a saved note is a correctness failure.
 *
 * `available` mirrors the registry's `isAvailable()` at import time. It is a
 * record, not the gate — §22.1 is explicit that the registry decides what may
 * be served, and staging is not permission.
 */
export const migration0006: Migration = {
  version: 6,
  name: 'translations',

  async up(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE translations (
        -- 'BSB:2026-08-08'. A release is its own row, never an overwrite.
        id             text        PRIMARY KEY,
        code           text        NOT NULL,
        name           text        NOT NULL,
        release        text        NOT NULL,

        -- The book ids this release actually carries, read from the USFM
        -- rather than assumed: §22.2 forbids validating an import against the
        -- registry's chapter counts, which record Hebrew versification.
        -- An array rather than a join table because it is read whole, never
        -- queried by element, and the alternative is 34 rows per translation
        -- carrying no other attribute (§24).
        books          text[]      NOT NULL,

        book_count     integer     NOT NULL,
        chapter_count  integer     NOT NULL,
        verse_count    integer     NOT NULL,

        -- Provenance (§21). Nullable because 'not stated' is a real answer
        -- and must never be read as permission (§22.1) — but a licence nobody
        -- recorded must be visibly absent rather than defaulted to something
        -- permissive.
        licence_name   text,
        licence_url    text,
        rights_holder  text,
        source_url     text,

        -- SHA256 of the publisher's archive. NOT NULL: a release whose bytes
        -- cannot be identified cannot have its licence verified (§22.3).
        archive_sha256 text        NOT NULL,

        imported_at    timestamptz NOT NULL DEFAULT now(),

        -- What isAvailable() said at import time. A record, not the gate.
        available      boolean     NOT NULL DEFAULT false,

        -- One row per code per release. The primary key already implies this
        -- given how the id is built, but the id is assembled by the caller
        -- and a constraint holds against every writer (§24).
        CONSTRAINT translations_code_release_unique UNIQUE (code, release)
      )
    `);

    // The reader resolves a translation by code, and wants the newest release
    // when more than one is loaded.
    await client.query(`
      CREATE INDEX translations_code_idx
        ON translations (code, release DESC)
    `);

    // "What may be served?" is asked on nearly every read path.
    await client.query(`
      CREATE INDEX translations_available_idx
        ON translations (available)
        WHERE available
    `);
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS translations');
  },
};
