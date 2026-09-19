/**
 * @scrinode/admin-ui — components for the internal backoffice.
 *
 * This package must NEVER be imported by @scrinode/web (AGENTS.md §8).
 * Admin code must not ship in the public bundle. The rule is enforced by an
 * ESLint boundary rule rather than left to convention.
 *
 * Components arrive as the backoffice is built in Stage 2 onward: data
 * tables, provenance forms, job monitors, audit views.
 */

export { AdminShell } from './admin-shell';
export type { AdminShellProps, AdminNavItem } from './admin-shell';
