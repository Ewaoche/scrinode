'use client';

import { AdminShell, type AdminNavItem } from '@scrinode/admin-ui';
import { useAdminSelector } from '../store/hooks';

/**
 * Sections the backoffice will expose, each gated on a permission.
 *
 * Declared now so navigation is permission-driven from the outset rather
 * than retrofitted. Nothing is visible until Stage 2 populates the session,
 * which is the correct closed default.
 */
const NAVIGATION: AdminNavItem[] = [
  { label: 'Sources', href: '/sources', requires: 'sources:read' },
  { label: 'Ingestion', href: '/ingestion', requires: 'ingestion:read' },
  { label: 'Moderation', href: '/moderation', requires: 'content:review' },
  { label: 'Users', href: '/users', requires: 'users:read' },
  { label: 'Zedek', href: '/zedek', requires: 'zedek:read' },
  { label: 'Feature flags', href: '/flags', requires: 'flags:write' },
  { label: 'Audit log', href: '/audit', requires: 'audit:read' },
];

export function Dashboard() {
  const permissions = useAdminSelector((state) => state.session.permissions);

  return (
    <AdminShell permissions={permissions} navigation={NAVIGATION}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Backoffice</h1>

      <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
        Scaffold. Admin identity and features arrive in Stage 2.
      </p>
    </AdminShell>
  );
}
