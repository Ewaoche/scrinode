'use client';

import { Button, LeafMark } from '@scrinode/ui';

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Vision', href: '#vision' },
  { label: 'Updates', href: '#updates' },
  { label: 'About', href: '#about' },
];

/**
 * The landing page header.
 *
 * Not the product navigation. §4 fixes that contract — Scripture, Study,
 * Zedek, Work, Library — and it does not apply here, because none of those
 * surfaces exist yet and a nav promising them would be a lie.
 */
export function SiteHeader() {
  return (
    <header
      style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        padding: '1.1rem clamp(1rem, 4vw, 3rem)',
      }}
    >
      <a
        href="#top"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.7rem',
          textDecoration: 'none',
        }}
      >
        <span style={{ color: '#c5a253', display: 'inline-flex' }}>
          <LeafMark />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            style={{
              fontFamily: 'var(--font-scripture)',
              fontSize: '1.5rem',
              color: '#f7f4ec',
              letterSpacing: '-0.01em',
            }}
          >
            Scrinode
          </span>
          {/* Hidden on narrow screens: the tagline is atmosphere, and at phone
              width the wordmark alone is clearer (§5). */}
          <span
            className="scrinode-tagline"
            style={{
              fontSize: '0.5625rem',
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              color: 'rgba(243,240,232,0.62)',
              marginTop: '0.3rem',
            }}
          >
            Scripture · Insight · For a Brighter Tomorrow
          </span>
        </span>
      </a>

      <nav
        aria-label="Landing page sections"
        className="scrinode-nav"
        style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}
      >
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              fontSize: '0.875rem',
              color: 'rgba(243,240,232,0.82)',
              textDecoration: 'none',
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <Button
        variant="gold"
        size="sm"
        onClick={() => {
          document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        Join the Waitlist
      </Button>
    </header>
  );
}
