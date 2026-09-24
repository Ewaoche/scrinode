import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MigrationRunner } from '../migration.runner';
import { MIGRATIONS } from './index';
import { NO_DATABASE_MESSAGE, createTestSchema, hasTestDatabase } from '../testing/postgres';

describe('migration registry', () => {
  it('has unique, ordered versions', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
  });

  it('gives every migration a down', () => {
    for (const migration of MIGRATIONS) {
      expect(typeof migration.down).toBe('function');
    }
  });
});

/**
 * Runs against a real PostgreSQL with pgvector. Constraints, unique indexes
 * and the halfvec column cannot be verified against a mock — and a mock that
 * accepted a query the real database rejects would be worse than no test.
 */
const describeWithDatabase = hasTestDatabase() ? describe : describe.skip;

if (!hasTestDatabase()) {
  console.warn(`\n[migrations.test] ${NO_DATABASE_MESSAGE}\n`);
}

describeWithDatabase('schema migrations', () => {
  let pool: Pool;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ pool, drop } = await createTestSchema('migrations'));
  }, 60_000);

  afterAll(async () => {
    await drop();
  });

  beforeEach(async () => {
    // Start each case from an empty schema. CASCADE because the auth tables
    // carry foreign keys.
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`,
    );

    for (const { tablename } of rows) {
      await pool.query(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
    }

    // Migration 0004 creates objects that are not tables, so dropping tables
    // alone left them behind and the next apply() failed on a duplicate
    // name. Recreating the schema outright is the honest reset: it cannot
    // miss an object type a future migration introduces.
    const schema = (
      await pool.query<{ current_schema: string }>('SELECT current_schema()')
    ).rows[0]!.current_schema;

    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.query(`CREATE SCHEMA ${schema}`);
  });

  const apply = () => new MigrationRunner(pool, MIGRATIONS).up();

  const indexNames = async (table: string): Promise<string[]> => {
    const { rows } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = current_schema() AND tablename = $1`,
      [table],
    );
    return rows.map((r) => r.indexname);
  };

  describe('0001 initial schema', () => {
    it('creates verse position indexes', async () => {
      await apply();

      expect(await indexNames('verses')).toContain('verses_position_idx');
      expect(await indexNames('verses')).toContain('verses_testament_idx');
    });

    it('enforces one text per verse per translation', async () => {
      await apply();

      const insert = (translation: string, text: string) =>
        pool.query(
          `INSERT INTO translation_texts
             (id, translation, reference_id, book_id, chapter, verse, text, ordinal, release)
           VALUES ($1, $2, 'ROM.8.28', 'ROM', 8, 28, $3, 45008028, '2026-01-01')`,
          [`${translation}:ROM.8.28`, translation, text],
        );

      await insert('WEB', 'first');

      // The same verse in the same translation must not be insertable twice.
      await expect(
        pool.query(
          `INSERT INTO translation_texts
             (id, translation, reference_id, book_id, chapter, verse, text, ordinal, release)
           VALUES ('other-id', 'WEB', 'ROM.8.28', 'ROM', 8, 28, 'dup', 45008028, '2026-01-01')`,
        ),
      ).rejects.toThrow();

      // The same verse in a different translation is fine.
      await expect(insert('KJV', 'other')).resolves.toBeDefined();
    });

    it('rejects a testament outside the canonical two', async () => {
      await apply();

      await expect(
        pool.query(
          `INSERT INTO verses (id, book_id, chapter, verse, testament, ordinal)
           VALUES ('ROM.8.28', 'ROM', 8, 28, 'Apocrypha', 45008028)`,
        ),
      ).rejects.toThrow();
    });

    it('enforces unique source ids', async () => {
      await apply();

      await pool.query(
        `INSERT INTO sources (source_id, source_name, source_type)
         VALUES ('stepbible', 'STEPBible', 'lexicon')`,
      );

      await expect(
        pool.query(
          `INSERT INTO sources (source_id, source_name, source_type)
           VALUES ('stepbible', 'Duplicate', 'lexicon')`,
        ),
      ).rejects.toThrow();
    });

    it('enforces unique admin emails', async () => {
      await apply();

      await pool.query(
        `INSERT INTO admin_users (email, password_hash) VALUES ('staff@scrinode.com', 'x')`,
      );

      await expect(
        pool.query(
          `INSERT INTO admin_users (email, password_hash) VALUES ('staff@scrinode.com', 'y')`,
        ),
      ).rejects.toThrow();
    });

    it('writes no data', async () => {
      await apply();

      // Safe to apply against a populated production database.
      for (const table of ['verses', 'translation_texts', 'sources', 'admin_users']) {
        const { rows } = await pool.query<{ count: string }>(
          `SELECT count(*) AS count FROM ${table}`,
        );
        expect(Number(rows[0]?.count)).toBe(0);
      }
    });
  });

  describe('0002 retrieval units', () => {
    it('stores and reads back a vector', async () => {
      await apply();

      const vector = `[${Array.from({ length: 1024 }, () => 0.01).join(',')}]`;

      await pool.query(
        `INSERT INTO retrieval_units (id, unit_type, text, source_id, embedding, embedding_model)
         VALUES ('u1', 'verse', 'text', 'src', $1::halfvec, 'voyage-4')`,
        [vector],
      );

      const { rows } = await pool.query<{ count: string }>(
        `SELECT count(*) AS count FROM retrieval_units WHERE embedding IS NOT NULL`,
      );
      expect(Number(rows[0]?.count)).toBe(1);
    });

    it('rejects a vector of the wrong width', async () => {
      // The column width and the embedding model must agree, or a search
      // would compare vectors from different spaces.
      await apply();

      await expect(
        pool.query(
          `INSERT INTO retrieval_units (id, unit_type, text, source_id, embedding, embedding_model)
           VALUES ('u2', 'verse', 'text', 'src', '[0.1,0.2,0.3]'::halfvec, 'voyage-4')`,
        ),
      ).rejects.toThrow();
    });

    it('refuses a vector with no model recorded', async () => {
      // Vectors from different models occupy unrelated spaces; one whose
      // model is unknown can never be safely compared or re-embedded.
      await apply();

      const vector = `[${Array.from({ length: 1024 }, () => 0.01).join(',')}]`;

      await expect(
        pool.query(
          `INSERT INTO retrieval_units (id, unit_type, text, source_id, embedding)
           VALUES ('u3', 'verse', 'text', 'src', $1::halfvec)`,
          [vector],
        ),
      ).rejects.toThrow();
    });

    it('creates the HNSW index the search query relies on', async () => {
      await apply();

      expect(await indexNames('retrieval_units')).toContain('retrieval_units_embedding_idx');
    });

    it('allows a unit with no vector, which is how work is found', async () => {
      await apply();

      await expect(
        pool.query(
          `INSERT INTO retrieval_units (id, unit_type, text, source_id)
           VALUES ('u4', 'passage', 'text', 'src')`,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('0003 auth tables', () => {
    it('gives users a non-sequential id', async () => {
      // A reader id reaches URLs and API responses; sequential integers
      // would make the user base enumerable.
      await apply();

      const { rows } = await pool.query<{ data_type: string }>(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users' AND column_name = 'id'`,
      );

      expect(rows[0]?.data_type).toBe('uuid');
    });

    it('refuses two accounts for one email', async () => {
      await apply();

      await pool.query(`INSERT INTO users (email) VALUES ('reader@example.com')`);

      await expect(
        pool.query(`INSERT INTO users (email) VALUES ('reader@example.com')`),
      ).rejects.toThrow();
    });

    it('deletes sessions with their user', async () => {
      // The adapter's deleteUser removes the user row before its sessions,
      // which plain foreign keys would reject — and a session outliving its
      // user is an authentication hazard.
      await apply();

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (email) VALUES ('gone@example.com') RETURNING id`,
      );
      const userId = rows[0]!.id;

      await pool.query(
        `INSERT INTO sessions ("userId", expires, "sessionToken")
         VALUES ($1, now() + interval '1 day', 'token')`,
        [userId],
      );

      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      const { rows: left } = await pool.query<{ count: string }>(
        'SELECT count(*) AS count FROM sessions',
      );
      expect(Number(left[0]?.count)).toBe(0);
    });

    it('refuses a session token used twice', async () => {
      await apply();

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (email) VALUES ('a@example.com') RETURNING id`,
      );
      const userId = rows[0]!.id;

      await pool.query(
        `INSERT INTO sessions ("userId", expires, "sessionToken")
         VALUES ($1, now() + interval '1 day', 'same-token')`,
        [userId],
      );

      await expect(
        pool.query(
          `INSERT INTO sessions ("userId", expires, "sessionToken")
           VALUES ($1, now() + interval '1 day', 'same-token')`,
          [userId],
        ),
      ).rejects.toThrow();
    });
  });

  describe('rollback', () => {
    it('drops the tables it created', async () => {
      const runner = new MigrationRunner(pool, MIGRATIONS);
      await runner.up();

      // One down per migration: the runner reverts the most recent only.
      for (let i = 0; i < MIGRATIONS.length; i += 1) {
        await runner.down();
      }

      const { rows } = await pool.query<{ exists: boolean }>(
        `SELECT to_regclass(current_schema() || '.verses') IS NOT NULL AS exists`,
      );
      expect(rows[0]?.exists).toBe(false);
    });

    it('can be applied, rolled back and re-applied', async () => {
      const runner = new MigrationRunner(pool, MIGRATIONS);

      await runner.up();
      for (let i = 0; i < MIGRATIONS.length; i += 1) {
        await runner.down();
      }

      await expect(runner.up()).resolves.toHaveLength(MIGRATIONS.length);
      expect(await indexNames('verses')).toContain('verses_position_idx');
    });
  });
});
