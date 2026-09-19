/**
 * @scrinode/types — shared domain primitives.
 *
 * This package has NO runtime dependencies (AGENTS.md §8). It is imported by
 * every app and package, including edge runtimes. Keep it type-only.
 */

export type {
  BookId,
  TranslationCode,
  CanonicalVerseId,
  Testament,
  BibleReference,
  Book,
  Verse,
} from './scripture.js';

export type { ScriptureContext, SelectionScope } from './context.js';

export type { SourceProvenance, Citation } from './provenance.js';

export type {
  Permission,
  AdminRoleName,
  AdminRole,
  AdminUser,
  AuditEvent,
} from './admin.js';
