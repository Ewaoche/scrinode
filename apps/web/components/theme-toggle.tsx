'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * Theme toggle.
 *
 * Deliberately unstyled scaffolding — it exists to prove theming is wired,
 * not to be the final control. Real UI comes later.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server cannot know the resolved theme, so rendering it before mount
  // would produce a hydration mismatch.
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} theme` : 'Switch theme'}
      style={{
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.375rem',
        // 44px minimum touch target — AGENTS.md §32.
        minHeight: '2.75rem',
      }}
    >
      {mounted ? (isDark ? 'Light theme' : 'Dark theme') : 'Theme'}
    </button>
  );
}
