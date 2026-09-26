import type { Migration } from '../migration.types';
import { migration0001 } from './0001-initial-schema';
import { migration0002 } from './0002-retrieval-units';
import { migration0003 } from './0003-auth-tables';
import { migration0004 } from './0004-text-search';
import { migration0005 } from './0005-ingest-ledger';
import { migration0006 } from './0006-translations';

/**
 * The migration registry, in version order.
 *
 * Append new migrations here. Never renumber or remove an applied migration:
 * its record persists in the database, and the runner needs its definition to
 * roll it back.
 */
export const MIGRATIONS: readonly Migration[] = [
  migration0001,
  migration0002,
  migration0003,
  migration0004,
  migration0005,
  migration0006,
];
