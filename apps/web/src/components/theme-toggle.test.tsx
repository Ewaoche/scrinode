import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from './theme-toggle';

const renderToggle = () =>
  render(
    <ThemeProvider attribute="data-theme" defaultTheme="light">
      <ThemeToggle />
    </ThemeProvider>,
  );

describe('ThemeToggle', () => {
  it('renders a button', () => {
    renderToggle();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('always has an accessible label', () => {
    // Including before mount, when the resolved theme is unknown.
    renderToggle();
    expect(screen.getByRole('button')).toHaveAccessibleName();
  });

  it('meets the minimum touch target height', () => {
    renderToggle();

    // AGENTS.md §32 — touch targets are an accessibility requirement.
    // Asserted against the inline style value rather than toHaveStyle, which
    // cannot resolve rem units under jsdom.
    const minHeight = screen.getByRole('button').style.minHeight;
    const rem = Number.parseFloat(minHeight);

    expect(minHeight).toMatch(/rem$/);
    // 2.75rem = 44px at the default root size, the WCAG 2.2 AA minimum.
    expect(rem * 16).toBeGreaterThanOrEqual(44);
  });
});
