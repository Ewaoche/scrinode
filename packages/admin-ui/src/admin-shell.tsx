import type { Permission } from '@scrinode/types';
import type { ReactNode } from 'react';

/**
 * A backoffice navigation destination.
 *
 * Each item declares the permission required to reach it. Navigation is
 * filtered by permission rather than by role, matching AGENTS.md §27.4:
 * permissions are checked, roles are only named bundles of them.
 */
export interface AdminNavItem {
  readonly label: string;
  readonly href: string;
  readonly requires: Permission;
}

export interface AdminShellProps {
  /** Permissions held by the signed-in admin. Empty until Stage 2 wires auth. */
  readonly permissions: readonly Permission[];
  readonly navigation: readonly AdminNavItem[];
  readonly children: ReactNode;
}

/**
 * Chrome for the internal backoffice.
 *
 * Hiding a navigation item is a usability measure, never a security one. The
 * API enforces every permission server-side through the globally guarded
 * admin module (§51.3); a hidden link that someone types directly must still
 * be refused there.
 */
export function AdminShell({ permissions, navigation, children }: AdminShellProps) {
  const held = new Set(permissions);
  const visible = navigation.filter((item) => held.has(item.requires));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(12rem, 16rem) 1fr', minHeight: '100vh' }}>
      <nav
        aria-label="Backoffice"
        style={{
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          padding: '1rem',
        }}
      >
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Scrinode Backoffice
        </p>

        {visible.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '1rem' }}>
            No sections available.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: '0.25rem' }}>
            {visible.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  style={{
                    display: 'block',
                    padding: '0.625rem 0.5rem',
                    minHeight: '2.75rem',
                    color: 'var(--color-text-primary)',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <main style={{ padding: '1.5rem' }}>{children}</main>
    </div>
  );
}
