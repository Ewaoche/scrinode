import type { Db } from 'mongodb';
import type { Migration } from '../migration.types';

/**
 * Baseline indexes.
 *
 * Creates indexes only — no data is written or modified, so this is safe to
 * apply against a populated production database.
 *
 * Collections follow AGENTS.md §24: many collections rather than giant nested
 * documents. Canonical verse identity is `BOOK.CHAPTER.VERSE` (§10), and
 * translation text is a representation of a verse rather than the verse
 * itself, so `translation_texts` is keyed by both.
 */
export const migration0001: Migration = {
  version: 1,
  name: 'initial-indexes',

  async up(db: Db): Promise<void> {
    // Canonical verses: _id is the canonical id (ROM.8.28), so lookups by id
    // are already covered. Index the parts used for range and book queries.
    await db.collection('verses').createIndexes([
      { key: { bookId: 1, chapter: 1, verse: 1 }, name: 'verse_position' },
      { key: { testament: 1 }, name: 'testament' },
    ]);

    // One document per verse per translation.
    await db.collection('translation_texts').createIndexes([
      {
        key: { referenceId: 1, translationId: 1 },
        name: 'reference_translation',
        unique: true,
      },
      { key: { translationId: 1 }, name: 'translation' },
    ]);

    // Source registry — AGENTS.md §21 requires provenance on every import.
    await db.collection('sources').createIndexes([
      { key: { sourceId: 1 }, name: 'source_id', unique: true },
      { key: { sourceType: 1 }, name: 'source_type' },
    ]);

    // Admin identity is a separate security domain from reader identity
    // (AGENTS.md §27). Separate collections, never a flag on `users`.
    await db.collection('admin_users').createIndexes([
      { key: { email: 1 }, name: 'admin_email', unique: true },
    ]);

    // Append-only audit log (AGENTS.md §33).
    await db.collection('admin_audit_log').createIndexes([
      { key: { at: -1 }, name: 'audit_recent' },
      { key: { actorId: 1, at: -1 }, name: 'audit_by_actor' },
    ]);

    // Migration bookkeeping.
    await db.collection('migrations').createIndexes([
      { key: { version: 1 }, name: 'migration_version', unique: true },
    ]);
  },

  async down(db: Db): Promise<void> {
    // Drop only the indexes this migration created. Dropping the collections
    // would destroy data this migration never wrote.
    const drops: [string, string][] = [
      ['verses', 'verse_position'],
      ['verses', 'testament'],
      ['translation_texts', 'reference_translation'],
      ['translation_texts', 'translation'],
      ['sources', 'source_id'],
      ['sources', 'source_type'],
      ['admin_users', 'admin_email'],
      ['admin_audit_log', 'audit_recent'],
      ['admin_audit_log', 'audit_by_actor'],
      ['migrations', 'migration_version'],
    ];

    for (const [collection, index] of drops) {
      try {
        await db.collection(collection).dropIndex(index);
      } catch {
        // Index or collection already absent — rollback stays idempotent.
      }
    }
  },
};
