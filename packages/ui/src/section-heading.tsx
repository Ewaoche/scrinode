import type { ReactNode } from 'react';

export interface SectionHeadingProps {
  /** Small tracked label above the title. Decorative framing, not a heading. */
  readonly eyebrow?: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly align?: 'left' | 'center';
  /** Light text for a dark scene, dark text for a pale one. */
  readonly tone?: 'light' | 'dark';
  /** Heading level. Never skipped — §32 requires a coherent outline. */
  readonly as?: 'h1' | 'h2' | 'h3';
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  tone = 'dark',
  as: Tag = 'h2',
}: SectionHeadingProps) {
  const light = tone === 'light';

  return (
    <header
      style={{
        textAlign: align,
        maxWidth: align === 'center' ? '46rem' : undefined,
        marginInline: align === 'center' ? 'auto' : undefined,
      }}
    >
      {eyebrow ? (
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            fontWeight: 600,
            // Wide tracking is the design's signature for these labels.
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: light ? 'rgba(243,240,232,0.72)' : 'var(--color-text-secondary)',
          }}
        >
          {eyebrow}
        </p>
      ) : null}

      <Tag
        style={{
          margin: eyebrow ? '0.85rem 0 0' : 0,
          fontFamily: 'var(--font-scripture)',
          fontWeight: 400,
          // Fluid rather than stepped: §5 wants the same layout to work from a
          // phone to a desktop without a cascade of breakpoints.
          fontSize: Tag === 'h1' ? 'clamp(2.75rem, 7vw, 4.5rem)' : 'clamp(1.8rem, 3.6vw, 2.6rem)',
          lineHeight: 1.12,
          letterSpacing: '-0.015em',
          color: light ? '#f7f4ec' : 'var(--color-text-primary)',
        }}
      >
        {title}
      </Tag>

      {description ? (
        <p
          style={{
            margin: '1.1rem 0 0',
            fontSize: 'clamp(1rem, 1.5vw, 1.125rem)',
            lineHeight: 1.65,
            color: light ? 'rgba(243,240,232,0.82)' : 'var(--color-text-secondary)',
          }}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
