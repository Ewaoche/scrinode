import type { Migration } from '../migration.types';
import { migration0001 } from './0001-initial-indexes';

/**
 * The migration registry, in version order.
 *
 * Append new migrations here. Never renumber or remove an applied migration:
 * its record persists in the database, and the runner needs its definition to
 * roll it back.
 */
export const MIGRATIONS: readonly Migration[] = [migration0001];
