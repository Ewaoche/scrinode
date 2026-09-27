import { LeafMark, Scene } from '@scrinode/ui';

/**
 * The copyright year, fixed rather than computed.
 *
 * `new Date().getFullYear()` at render time is a hydration hazard: the server
 * and the browser evaluate it separately, and across New Year in different
 * time zones they disagree — server in UTC reading 2027 while a browser in
 * UTC-5 still reads 2026. React reports that as a mismatch and does not patch
 * it up.
 *
 * It is also wrong in the other direction under static rendering, where the
 * year is baked in at build time and then never changes.
 *
 * A constant is honest about what this is: a value someone updates, once a
 * year, deliberately.
 */
const COPYRIGHT_YEAR = 2026;

const LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Features', href: '#features' },
  { label: 'Updates', href: '#updates' },
  { label: 'Contact', href: '#contact' },
];

/**
 * The footer.
 *
 * Uses `/bgs/footer.jpg` behind a strong scrim rather than a flat colour. The
 * scrim does more work here than in the hero: footer text is small, and §32's
 * contrast requirement is stricter for small text than for a headline, so the
 * image has to recede further.
 */
export function SiteFooter() {
  return (
    <Scene
      tone="depth"
      image="/bgs/footer.jpg"
      scrim="veil"
      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
    <footer
      id="about"
      style={{
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
          © {COPYRIGHT_YEAR} Scrinode. All rights reserved.
        </p>
      </div>
    </footer>
    </Scene>
  );
}
