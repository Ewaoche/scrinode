import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, type Db } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MigrationRunner } from '../migration.runner';
import { MIGRATIONS } from './index';

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

describe('0001-initial-indexes', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
    db = client.db('index_test');
  }, 120_000);

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    const collections = await db.collections();
    await Promise.all(collections.map((c) => c.drop().catch(() => undefined)));
  });

  const indexNames = async (collection: string): Promise<string[]> => {
    const indexes = await db.collection(collection).indexes();
    return indexes.map((i) => i.name ?? '');
  };

  it('creates verse position indexes', async () => {
    await new MigrationRunner(db, MIGRATIONS).up();

    expect(await indexNames('verses')).toContain('verse_position');
    expect(await indexNames('verses')).toContain('testament');
  });

  it('creates a unique reference+translation index', async () => {
    await new MigrationRunner(db, MIGRATIONS).up();

    const indexes = await db.collection('translation_texts').indexes();
    const composite = indexes.find((i) => i.name === 'reference_translation');

    expect(composite?.unique).toBe(true);
  });

  it('enforces one text per verse per translation', async () => {
    await new MigrationRunner(db, MIGRATIONS).up();

    const texts = db.collection('translation_texts');
    await texts.insertOne({ referenceId: 'ROM.8.28', translationId: 'WEB', text: 'first' });

    // The same verse in the same translation must not be insertable twice.
    await expect(
      texts.insertOne({ referenceId: 'ROM.8.28', translationId: 'WEB', text: 'duplicate' }),
    ).rejects.toThrow();

    // The same verse in a different translation is fine.
    await expect(
      texts.insertOne({ referenceId: 'ROM.8.28', translationId: 'KJV', text: 'other' }),
    ).resolves.toBeDefined();
  });

  it('enforces unique source ids', async () => {
    await new MigrationRunner(db, MIGRATIONS).up();

    const sources = db.collection('sources');
    await sources.insertOne({ sourceId: 'stepbible', sourceName: 'STEPBible' });

    await expect(sources.insertOne({ sourceId: 'stepbible', sourceName: 'Duplicate' })).rejects.toThrow();
  });

  it('enforces unique admin emails', async () => {
    await new MigrationRunner(db, MIGRATIONS).up();

    const admins = db.collection('admin_users');
    await admins.insertOne({ email: 'staff@scrinode.com' });

    await expect(admins.insertOne({ email: 'staff@scrinode.com' })).rejects.toThrow();
  });

  it('writes no data', async () => {
    await new MigrationRunner(db, MIGRATIONS).up();

    // Safe to apply against a populated production database.
    for (const collection of ['verses', 'translation_texts', 'sources', 'admin_users']) {
      expect(await db.collection(collection).countDocuments()).toBe(0);
    }
  });

  it('removes its indexes on rollback', async () => {
    const runner = new MigrationRunner(db, MIGRATIONS);
    await runner.up();
    await runner.down();

    expect(await indexNames('verses')).not.toContain('verse_position');
    expect(await indexNames('translation_texts')).not.toContain('reference_translation');
  });

  it('preserves data on rollback', async () => {
    const runner = new MigrationRunner(db, MIGRATIONS);
    await runner.up();

    await db.collection('sources').insertOne({ sourceId: 'kept', sourceName: 'Kept' });
    await runner.down();

    // Rollback drops indexes it created, never data it never wrote.
    expect(await db.collection('sources').countDocuments()).toBe(1);
  });

  it('can be applied, rolled back and re-applied', async () => {
    const runner = new MigrationRunner(db, MIGRATIONS);

    await runner.up();
    await runner.down();
    await expect(runner.up()).resolves.toHaveLength(MIGRATIONS.length);

    expect(await indexNames('verses')).toContain('verse_position');
  });
});
