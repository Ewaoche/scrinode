/**
 * Admin identity and RBAC — AGENTS.md §27.
 *
 * Admin identity is a SEPARATE security domain from reader identity, not a
 * role on a reader account. These types must never leak into public API
 * response shapes (AGENTS.md §8).
 */

/**
 * Permissions are checked, never roles. A role is a named bundle of
 * permissions, so new roles can be added without touching guard logic.
 */
export type Permission =
  | 'sources:read'
  | 'sources:write'
  | 'ingestion:run'
  | 'ingestion:read'
  | 'content:review'
  | 'content:publish'
  | 'users:read'
  | 'users:write'
  | 'zedek:configure'
  | 'zedek:read'
  | 'flags:write'
  | 'admin:manage'
  | 'audit:read';

export type AdminRoleName =
  | 'superadmin'
  | 'data-admin'
  | 'content-moderator'
  | 'support'
  | 'observer';

export interface AdminRole {
  readonly name: AdminRoleName;
  readonly permissions: readonly Permission[];
}

/** An internal staff account. Never the same collection as reader `users`. */
export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly AdminRoleName[];
  readonly mfaEnabled: boolean;
  readonly createdAt: Date;
  readonly lastLoginAt?: Date;
}

/**
 * An entry in the append-only audit log — AGENTS.md §33.
 *
 * Every mutating admin action writes one. No role, including superadmin, may
 * delete from the log.
 */
export interface AuditEvent {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly target: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly ip?: string;
  readonly at: Date;
}
