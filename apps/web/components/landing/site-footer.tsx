import { LeafMark } from '@scrinode/ui';

const LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Features', href: '#features' },
  { label: 'Updates', href: '#updates' },
  { label: 'Contact', href: '#contact' },
];

export function SiteFooter() {
  return (
    <footer
      id="about"
      style={{
        background: '#101725',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: 'clamp(1.75rem, 4vw, 2.25rem) clamp(1rem, 4vw, 3rem)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          maxWidth: '76rem',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.7rem' }}>
          <span style={{ color: '#c5a253', display: 'inline-flex' }}>
            <LeafMark />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              style={{
                fontFamily: 'var(--font-scripture)',
                fontSize: '1.3rem',
                color: '#f7f4ec',
              }}
            >
              Scrinode
            </span>
            <span
              style={{
                fontSize: '0.5rem',
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: 'rgba(243,240,232,0.55)',
                marginTop: '0.3rem',
              }}
            >
              Scripture · Insight · For a Brighter Tomorrow
            </span>
          </span>
        </div>

        <nav aria-label="Footer" style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontSize: '0.8125rem',
                color: 'rgba(243,240,232,0.74)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(243,240,232,0.5)' }}>
          © {new Date().getFullYear()} Scrinode. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
