import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MigrationRunner } from '../migration.runner';
import { MIGRATIONS } from './index';
import { NO_DATABASE_MESSAGE, createTestSchema, hasTestDatabase } from '../testing/postgres';

/**
 * Proves the §14 search capabilities actually work.
 *
 * These assert behaviour, not schema. An earlier version of this stack had
 * `unaccent` installed and unusable — the extension was present, so every
 * structural check passed, while `to_tsvector` ignored it completely. Only a
 * query proves the difference.
 */
const describeWithDatabase = hasTestDatabase() ? describe : describe.skip;

if (!hasTestDatabase()) {
  console.warn(`\n[text-search.test] ${NO_DATABASE_MESSAGE}\n`);
}

describeWithDatabase('text search', () => {
  let pool: Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema('text_search'));
    await new MigrationRunner(pool, MIGRATIONS).up();

    // A few verses carrying the cases that matter: diacritics, a proper name
    // with a well-known misspelling, and a Douay-Rheims name differing from
    // its Protestant counterpart.
    const rows: [string, string, string, string, number, number, string, number][] = [
      ['BSB:JHN.3.16', 'BSB', 'JHN.3.16', 'JHN', 3, 16, 'For God so loved the world', 43003016],
      ['BSB:DAN.1.1', 'BSB', 'DAN.1.1', 'DAN', 1, 1, 'Nebuchadnezzar king of Babylon came', 27001001],
      ['BSB:LUK.19.2', 'BSB', 'LUK.19.2', 'LUK', 19, 2, 'a man named Zacchaeus was there', 42019002],
      ['BSB:1CO.13.4', 'BSB', '1CO.13.4', '1CO', 13, 4, 'Love agápē is patient and kind', 46013004],
      ['DRA:ISA.1.1', 'DRA', 'ISA.1.1', 'ISA', 1, 1, 'The vision of Isaias the son of Amos', 23001001],
    ];

    for (const [id, translation, ref, book, chapter, verse, text, ordinal] of rows) {
      await pool.query(
        `INSERT INTO translation_texts
           (id, translation, reference_id, book_id, chapter, verse, text, ordinal, release)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2026-01-01')`,
        [id, translation, ref, book, chapter, verse, text, ordinal],
      );
    }
  }, 60_000);

  afterAll(async () => {
    await drop();
  });

  describe('accent-insensitive full-text search', () => {
    it('finds an accented word from an unaccented query', async () => {
      // The case the whole configuration exists for. Transliterated Greek
      // reaches the reader with diacritics nobody types.
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE search_vector @@ to_tsquery('scrinode_english', 'agape')`,
      );

      expect(rows.map((r) => r.id)).toContain('BSB:1CO.13.4');
    });

    it('finds an unaccented word from an accented query', async () => {
      // Symmetric: a reader who does paste diacritics must not get less.
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE search_vector @@ to_tsquery('scrinode_english', 'Bábylon')`,
      );

      expect(rows.map((r) => r.id)).toContain('BSB:DAN.1.1');
    });

    it('still stems, so a search for "loved" finds "love"', async () => {
      // unaccent must run *before* english_stem, not replace it. If the
      // dictionary chain were wrong, stemming would quietly stop.
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE search_vector @@ to_tsquery('scrinode_english', 'loving')`,
      );

      expect(rows.map((r) => r.id)).toContain('BSB:JHN.3.16');
    });

    it('names the configuration in the stored expression', async () => {
      // The one-argument to_tsvector(text) is STABLE — it reads
      // default_text_search_config — and Postgres would refuse it in a
      // generated column. The two-argument form is IMMUTABLE, and naming the
      // configuration also means a session that changed the default cannot
      // silently produce a vector the index does not match.
      const { rows } = await pool.query<{ expression: string }>(
        `SELECT pg_get_expr(d.adbin, d.adrelid) AS expression
           FROM pg_attrdef d
           JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
          WHERE a.attname = 'search_vector'
            AND d.adrelid = (current_schema() || '.translation_texts')::regclass`,
      );

      expect(rows[0]?.expression).toContain('scrinode_english');
    });

    it('keeps the search vector in step with the text', async () => {
      // A generated column, so this holds without a trigger anyone can
      // forget to fire.
      await pool.query(
        `INSERT INTO translation_texts
           (id, translation, reference_id, book_id, chapter, verse, text, ordinal, release)
         VALUES ('BSB:PSA.23.1', 'BSB', 'PSA.23.1', 'PSA', 23, 1,
                 'The LORD is my shepherd', 19023001, '2026-01-01')`,
      );

      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE search_vector @@ to_tsquery('scrinode_english', 'shepherd')`,
      );

      expect(rows.map((r) => r.id)).toContain('BSB:PSA.23.1');

      await pool.query(`DELETE FROM translation_texts WHERE id = 'BSB:PSA.23.1'`);
    });
  });

  describe('phonetic matching for proper names', () => {
    it('matches a misspelled name by sound', async () => {
      // dmetaphone compares pronunciation, where trigram compares spelling.
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE EXISTS (
            SELECT 1 FROM regexp_split_to_table(text, '\\s+') AS word
             WHERE dmetaphone(word) = dmetaphone($1)
          )`,
        ['Nebuchadnezer'],
      );

      expect(rows.map((r) => r.id)).toContain('BSB:DAN.1.1');
    });

    it('matches a Douay-Rheims name a reader spells the Protestant way', async () => {
      // Douay-Rheims prints Isaias where other editions print Isaiah, and
      // Scrinode serves both (AGENTS.md §22.2).
      //
      // Two things measured against a real database shaped this query, and
      // neither was obvious from reading the documentation.
      //
      // 1. dmetaphone EQUALITY does not bridge this pair. Double Metaphone
      //    encodes trailing consonants: Isaiah is 'AS', Isaias is 'ASS'.
      //    An earlier version asserted equality, looked right, and failed.
      //
      // 2. Phonetic distance ALONE is far too loose. dmetaphone('was') is
      //    also 'AS' — distance 0 from Isaiah. So are 'is', 'as', 'ease'
      //    and 'Esau'. A phonetic-only rule matches the commonest words in
      //    the text.
      //
      // So the rule needs both halves: the sound must be close, and the
      // spelling must not be wildly different. The spelling bound is
      // normalised by length, because a fixed edit distance is generous for
      // a short word and harsh for Nebuchadnezzar.
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE EXISTS (
            SELECT 1 FROM regexp_split_to_table(text, '\\s+') AS word
             WHERE levenshtein(dmetaphone(word), dmetaphone($1)) <= 1
               AND levenshtein(lower(word), lower($1))::numeric
                     / greatest(length(word), length($1)) <= 0.5
          )`,
        ['Isaiah'],
      );

      expect(rows.map((r) => r.id)).toContain('DRA:ISA.1.1');
    });

    it('does not match common words that merely sound like a name', async () => {
      // The failure mode the spelling bound exists to prevent. Without it,
      // searching for Isaiah returns every verse containing "was".
      const { rows } = await pool.query<{ id: string }>(
        `SELECT id FROM translation_texts
          WHERE EXISTS (
            SELECT 1 FROM regexp_split_to_table(text, '\\s+') AS word
             WHERE levenshtein(dmetaphone(word), dmetaphone($1)) <= 1
               AND levenshtein(lower(word), lower($1))::numeric
                     / greatest(length(word), length($1)) <= 0.5
          )`,
        ['Isaiah'],
      );

      // "a man named Zacchaeus was there" contains 'was', whose phonetic
      // code is identical to Isaiah's.
      expect(rows.map((r) => r.id)).not.toContain('BSB:LUK.19.2');
    });

    it('bridges the other Douay-Rheims name pairs too', async () => {
      // One pair could be luck. These are the three §22.2 names, plus the
      // Elijah/Elias pair the New Testament itself uses.
      const pairs: readonly [string, string][] = [
        ['Isaiah', 'Isaias'],
        ['Hosea', 'Osee'],
        ['Obadiah', 'Abdias'],
        ['Elijah', 'Elias'],
      ];

      for (const [protestant, douay] of pairs) {
        const { rows } = await pool.query<{ matches: boolean }>(
          `SELECT levenshtein(dmetaphone($1), dmetaphone($2)) <= 1
              AND levenshtein(lower($1), lower($2))::numeric
                    / greatest(length($1), length($2)) <= 0.5 AS matches`,
          [protestant, douay],
        );

        expect(rows[0]?.matches, `${protestant} should match ${douay}`).toBe(true);
      }
    });

    it('records how far apart the Isaiah/Isaias codes actually are', async () => {
      // Pins the measurement the rule above is built on. If a Postgres
      // upgrade changes Double Metaphone, this fails and names the reason
      // rather than leaving the search silently worse.
      const { rows } = await pool.query<{
        protestant: string;
        douay: string;
        distance: number;
      }>(
        `SELECT dmetaphone('Isaiah') AS protestant,
                dmetaphone('Isaias') AS douay,
                levenshtein(dmetaphone('Isaiah'), dmetaphone('Isaias')) AS distance`,
      );

      const row = rows[0]!;

      // Not equal — the reason dmetaphone equality was the wrong test.
      expect(row.protestant).not.toBe(row.douay);

      // But close enough that a distance of 1 bridges them.
      expect(row.distance).toBeLessThanOrEqual(1);
    });

    it('measures edit distance, for ranking near-misses', async () => {
      expect(
        (await pool.query<{ d: number }>('SELECT levenshtein($1, $2) AS d', ['Zaccheus', 'Zacchaeus']))
          .rows[0]?.d,
      ).toBe(1);
    });
  });

  describe('immutable_unaccent', () => {
    it('strips diacritics', async () => {
      const { rows } = await pool.query<{ result: string }>(
        `SELECT immutable_unaccent('agápē') AS result`,
      );

      expect(rows[0]?.result).toBe('agape');
    });

    it('is immutable, which is what lets it be indexed', async () => {
      // Stock unaccent() is STABLE and Postgres refuses it in an index
      // expression. The refusal reads like the extension being missing, so
      // this pins the reason.
      const { rows } = await pool.query<{ provolatile: string }>(
        `SELECT provolatile FROM pg_proc WHERE proname = 'immutable_unaccent'`,
      );

      expect(rows[0]?.provolatile).toBe('i');
    });

    it('backs an index that exists', async () => {
      const { rows } = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = current_schema()
            AND indexname = 'translation_texts_unaccent_trgm_idx'`,
      );

      expect(rows).toHaveLength(1);
    });
  });

  describe('index hygiene', () => {
    it('drops the plain trigram index the accent-aware one supersedes', async () => {
      // Two GIN indexes over one column would double the maintenance cost of
      // every verse insert for no added capability.
      const { rows } = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = current_schema()
            AND indexname = 'translation_texts_text_trgm_idx'`,
      );

      expect(rows).toHaveLength(0);
    });

    it('restores that index on rollback', async () => {
      // Rolling back must leave migration 0001's schema as 0001 built it.
      const runner = new MigrationRunner(pool, MIGRATIONS);
      await runner.down();

      const { rows } = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = current_schema()
            AND indexname = 'translation_texts_text_trgm_idx'`,
      );

      expect(rows).toHaveLength(1);

      // Leave the schema as the suite found it.
      await runner.up();
    });
  });
});
