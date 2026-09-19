import type { Permission } from '@scrinode/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminShell, type AdminNavItem } from './admin-shell';

const NAVIGATION: AdminNavItem[] = [
  { label: 'Sources', href: '/sources', requires: 'sources:read' },
  { label: 'Ingestion', href: '/ingestion', requires: 'ingestion:read' },
  { label: 'Moderation', href: '/moderation', requires: 'content:review' },
  { label: 'Audit log', href: '/audit', requires: 'audit:read' },
];

const renderShell = (permissions: Permission[]) =>
  render(
    <AdminShell permissions={permissions} navigation={NAVIGATION}>
      <p>Content</p>
    </AdminShell>,
  );

describe('AdminShell', () => {
  it('renders its children', () => {
    renderShell(['sources:read']);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('labels the navigation landmark', () => {
    renderShell(['sources:read']);
    expect(screen.getByRole('navigation', { name: 'Backoffice' })).toBeInTheDocument();
  });

  describe('permission filtering', () => {
    it('shows only sections the admin holds a permission for', () => {
      renderShell(['sources:read']);

      expect(screen.getByRole('link', { name: 'Sources' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Ingestion' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Audit log' })).not.toBeInTheDocument();
    });

    it('shows several sections when several permissions are held', () => {
      renderShell(['sources:read', 'audit:read']);

      expect(screen.getByRole('link', { name: 'Sources' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Audit log' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Moderation' })).not.toBeInTheDocument();
    });

    it('shows nothing with no permissions', () => {
      renderShell([]);

      expect(screen.queryAllByRole('link')).toHaveLength(0);
      expect(screen.getByText('No sections available.')).toBeInTheDocument();
    });

    it('ignores a permission that matches no section', () => {
      renderShell(['flags:write']);

      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('does not grant access from a related but different permission', () => {
      // Holding sources:read must not reveal a section requiring
      // sources:write. Permissions are matched exactly, never by prefix.
      render(
        <AdminShell
          permissions={['sources:read']}
          navigation={[{ label: 'Edit sources', href: '/sources/edit', requires: 'sources:write' }]}
        >
          <p>Content</p>
        </AdminShell>,
      );

      expect(screen.queryByRole('link', { name: 'Edit sources' })).not.toBeInTheDocument();
    });
  });

  it('gives navigation links an adequate touch target', () => {
    renderShell(['sources:read']);

    const link = screen.getByRole('link', { name: 'Sources' });
    expect(Number.parseFloat(link.style.minHeight) * 16).toBeGreaterThanOrEqual(44);
  });
});
