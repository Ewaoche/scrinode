import type { PoolClient } from 'pg';
import type { Migration } from '../migration.types';

/**
 * Text search configuration and indexes for §14's keyword and phrase classes.
 *
 * `unaccent` being installed does nothing on its own. It is a *filtering
 * dictionary*: `unaccent('Hôtel')` works as a function call, but
 * `to_tsvector` ignores it entirely unless a text search configuration names
 * it in the dictionary chain. Without this migration the extension is a
 * false promise — accent-insensitive search simply does not happen.
 *
 * What this creates:
 *
 *   - `scrinode_english`, an English configuration that strips diacritics
 *     before stemming
 *   - `immutable_unaccent`, because the stock `unaccent()` cannot be used in
 *     an index expression
 *   - a full-text index over verse text, and a trigram index over proper
 *     names for phonetic matching
 *
 * Why accents matter for Scripture specifically: transliterated Greek and
 * Hebrew reach the reader with diacritics nobody types. A search for
 * "agape" must find "agápē", and "Yahweh" must find "Yahwêh".
 */
export const migration0004: Migration = {
  version: 4,
  name: 'text-search',

  async up(client: PoolClient): Promise<void> {
    // --- accent-insensitive stemming ---------------------------------------

    // Copied from `english` rather than built from scratch: the stemmer and
    // stop-word list are the parts we want unchanged, and the only edit is
    // inserting unaccent ahead of them.
    await client.query(`
      CREATE TEXT SEARCH CONFIGURATION scrinode_english ( COPY = pg_catalog.english )
    `);

    // unaccent runs first and passes its output to english_stem. Order is
    // the whole point: stemming an accented word gives a different stem.
    await client.query(`
      ALTER TEXT SEARCH CONFIGURATION scrinode_english
        ALTER MAPPING FOR hword, hword_part, word
        WITH unaccent, english_stem
    `);

    /**
     * An immutable wrapper around unaccent().
     *
     * `unaccent(text)` is declared STABLE, not IMMUTABLE, because it reads a
     * rules file that could in principle change. Postgres therefore refuses
     * it in an index expression, and the refusal is easy to misread as the
     * extension being unavailable.
     *
     * The two-argument form naming the dictionary explicitly is what makes
     * the wrapper honest: it pins the rules being used rather than depending
     * on a search-path lookup. Marking it IMMUTABLE is a promise that the
     * `unaccent` dictionary will not be redefined underneath the index — if
     * it ever is, indexes built on this must be rebuilt.
     */
    await client.query(`
      CREATE FUNCTION immutable_unaccent(text)
        RETURNS text
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
        STRICT
      AS $$ SELECT public.unaccent('public.unaccent', $1) $$
    `);

    // --- full-text search over Scripture -----------------------------------

    // A generated column rather than an expression index: the tsvector is
    // then visible, inspectable and usable in a query without repeating the
    // expression, and Postgres keeps it in step with the text on its own.
    //
    // The configuration is named explicitly. Relying on
    // default_text_search_config would make the index depend on a session
    // setting, and a query run under a different one would silently miss.
    await client.query(`
      ALTER TABLE translation_texts
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('scrinode_english', text)) STORED
    `);

    await client.query(`
      CREATE INDEX translation_texts_search_idx
        ON translation_texts USING gin (search_vector)
    `);

    // Keyword search is always scoped to a translation — unscoped, a hit
    // repeats once per translation loaded. btree_gin lets one index serve
    // both halves instead of a bitmap merge across two.
    await client.query(`
      CREATE INDEX translation_texts_search_scoped_idx
        ON translation_texts USING gin (translation, search_vector)
    `);

    // --- phonetic matching for proper names --------------------------------

    // Accent-insensitive trigram matching, for partial and misspelled input.
    // Distinct from the full-text index above, which only matches whole
    // stemmed words: a reader typing "nebuchadnez" has no whole word yet.
    await client.query(`
      CREATE INDEX translation_texts_unaccent_trgm_idx
        ON translation_texts
        USING gin (immutable_unaccent(text) gin_trgm_ops)
    `);

    // Migration 0001's plain trigram index is now redundant: this one covers
    // the same queries and additionally ignores diacritics. Keeping both
    // would make every verse insert maintain two GIN indexes over one
    // column, and GIN maintenance is the expensive kind.
    //
    // Dropped here rather than by editing 0001, which has already been
    // applied. A migration's history is a record of what ran.
    await client.query('DROP INDEX IF EXISTS translation_texts_text_trgm_idx');
  },

  async down(client: PoolClient): Promise<void> {
    // Restore the index this migration dropped. Rolling back must leave
    // migration 0001's schema exactly as 0001 built it, or the rollback
    // quietly removes a capability nobody asked it to remove.
    await client.query(`
      CREATE INDEX IF NOT EXISTS translation_texts_text_trgm_idx
        ON translation_texts USING gin (text gin_trgm_ops)
    `);

    // Reverse creation order. Dropping the column takes its indexes with it,
    // but the indexes on other expressions must go first.
    await client.query('DROP INDEX IF EXISTS translation_texts_unaccent_trgm_idx');
    await client.query('DROP INDEX IF EXISTS translation_texts_search_scoped_idx');
    await client.query('DROP INDEX IF EXISTS translation_texts_search_idx');

    await client.query('ALTER TABLE translation_texts DROP COLUMN IF EXISTS search_vector');

    // CASCADE because the trigram index above depends on it; that index is
    // already gone, so this only guards a partially-applied state.
    await client.query('DROP FUNCTION IF EXISTS immutable_unaccent(text) CASCADE');

    await client.query('DROP TEXT SEARCH CONFIGURATION IF EXISTS scrinode_english');
  },
};
