import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * Baseline schema.
 *
 * Creates tables and indexes only — no data is written or modified.
 *
 * Tables follow AGENTS.md §24: many narrow tables rather than wide documents.
 * Canonical verse identity is `BOOK.CHAPTER.VERSE` (§10), and translation
 * text is a representation of a verse rather than the verse itself, so
 * `translation_texts` is keyed by both.
 *
 * Naming is `snake_case` throughout, which is Postgres's unquoted-identifier
 * folding. A quoted `"camelCase"` column would have to be quoted in every
 * query thereafter, and the first one forgotten is a runtime error.
 */
export const migration0001: Migration = {
  version: 1,
  name: 'initial-schema',

  async up(client: PoolClient): Promise<void> {
    // --- canonical Scripture ------------------------------------------------

    // The canonical verse, independent of any translation. `id` is the
    // canonical reference (ROM.8.28) rather than a surrogate key: it is
    // already stable, already meaningful, and already what cross-references
    // and user notes point at.
    await client.query(`
      CREATE TABLE verses (
        id         text    PRIMARY KEY,
        book_id    text    NOT NULL,
        chapter    integer NOT NULL,
        verse      integer NOT NULL,
        testament  text    NOT NULL,
        canon      text    NOT NULL DEFAULT 'protestant',
        ordinal    bigint  NOT NULL,

        CONSTRAINT verses_testament_valid CHECK (testament IN ('OT', 'NT')),
        CONSTRAINT verses_canon_valid
          CHECK (canon IN ('protestant', 'deuterocanonical')),
        CONSTRAINT verses_chapter_positive CHECK (chapter > 0),
        CONSTRAINT verses_verse_positive   CHECK (verse > 0)
      )
    `);

    await client.query(
      'CREATE INDEX verses_position_idx ON verses (book_id, chapter, verse)',
    );
    await client.query('CREATE INDEX verses_testament_idx ON verses (testament)');
    await client.query('CREATE INDEX verses_ordinal_idx ON verses (ordinal)');

    // One row per verse per translation.
    //
    // `id` is the deterministic `BSB:ROM.8.28` the importer already produces,
    // which makes re-importing a release idempotent. A large import that
    // fails partway can simply be re-run.
    await client.query(`
      CREATE TABLE translation_texts (
        id            text    PRIMARY KEY,
        translation   text    NOT NULL,
        reference_id  text    NOT NULL,
        book_id       text    NOT NULL,
        canon         text    NOT NULL DEFAULT 'protestant',
        chapter       integer NOT NULL,
        verse         integer NOT NULL,
        -- Last verse of a merged range, where an edition merged verses.
        verse_end     integer,
        -- Letter suffix where an edition subdivides a verse, e.g. the 'a' of
        -- Brenton's Genesis 31:50a. Without it, 31:50 and 31:50a collapse
        -- into one row and text is lost.
        suffix        text,
        text          text    NOT NULL,
        ordinal       bigint  NOT NULL,
        -- Ties every verse back to a manifest (AGENTS.md §22.3).
        release       text    NOT NULL,

        CONSTRAINT translation_texts_reference_translation
          UNIQUE (reference_id, translation),
        CONSTRAINT translation_texts_canon_valid
          CHECK (canon IN ('protestant', 'deuterocanonical'))
      )
    `);

    // The reader's primary access pattern: one chapter in one translation.
    await client.query(`
      CREATE INDEX translation_texts_chapter_idx
        ON translation_texts (translation, book_id, chapter, verse)
    `);

    // Ordered reads and ranges crossing book boundaries.
    await client.query(`
      CREATE INDEX translation_texts_ordinal_idx
        ON translation_texts (translation, ordinal)
    `);

    // Removing or replacing one release without touching the rest.
    await client.query(`
      CREATE INDEX translation_texts_release_idx
        ON translation_texts (translation, release)
    `);

    // Keyword search (§14). A trigram index serves partial and misspelled
    // input, which is what a reader recalling half a phrase actually types.
    // Full-text search over stemmed words is a separate index, added when
    // the search surface that needs it exists.
    await client.query(`
      CREATE INDEX translation_texts_text_trgm_idx
        ON translation_texts USING gin (text gin_trgm_ops)
    `);

    // --- provenance (§21) ---------------------------------------------------

    await client.query(`
      CREATE TABLE sources (
        source_id    text        PRIMARY KEY,
        source_name  text        NOT NULL,
        source_type  text        NOT NULL,
        license      text,
        attribution  text,
        source_url   text,
        imported_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query('CREATE INDEX sources_type_idx ON sources (source_type)');

    // --- admin identity (§27.2) --------------------------------------------

    // A separate security domain from reader identity, not a flag on a shared
    // table. Reader tables are owned by the Auth.js adapter and created by a
    // later migration; nothing joins these two.
    await client.query(`
      CREATE TABLE admin_users (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text        NOT NULL,
        name          text,
        password_hash text        NOT NULL,
        mfa_secret    text,
        disabled_at   timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT admin_users_email_unique UNIQUE (email)
      )
    `);

    // Append-only audit log (§33). No role, including superadmin, may delete
    // from it; that is enforced by grants at deploy time, and by there being
    // no delete path in code.
    await client.query(`
      CREATE TABLE admin_audit_log (
        id         bigserial   PRIMARY KEY,
        actor_id   uuid,
        action     text        NOT NULL,
        target     text,
        before     jsonb,
        after      jsonb,
        ip         inet,
        at         timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query('CREATE INDEX admin_audit_log_recent_idx ON admin_audit_log (at DESC)');
    await client.query(
      'CREATE INDEX admin_audit_log_actor_idx ON admin_audit_log (actor_id, at DESC)',
    );
  },

  async down(client: PoolClient): Promise<void> {
    // Drops only what this migration created. Order matters where foreign
    // keys exist; none do yet, but dropping in reverse creation order keeps
    // that true as the schema grows.
    for (const table of [
      'admin_audit_log',
      'admin_users',
      'sources',
      'translation_texts',
      'verses',
    ]) {
      await client.query(`DROP TABLE IF EXISTS ${table}`);
    }
  },
};
