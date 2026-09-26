import type { ReactNode } from 'react';
import { Scene, type SceneTone } from './scene';

/**
 * A domain card — one of the five product areas (§3).
 *
 * The visual pattern from the design: an image band on top, a rounded panel
 * overlapping it from below, and the domain's icon straddling the join.
 */
export interface FeatureCardProps {
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
  /** The §6 semantic accent for this domain. */
  readonly accent: string;
  readonly image?: string;
  readonly tone?: SceneTone;
}

export function FeatureCard({
  title,
  description,
  icon,
  accent,
  image,
  tone = 'dawn',
}: FeatureCardProps) {
  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '1.1rem',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 2px rgba(28,36,48,0.04), 0 8px 24px -12px rgba(28,36,48,0.14)',
        height: '100%',
      }}
    >
      <Scene
        tone={tone}
        {...(image ? { image } : {})}
        scrim="none"
        style={{ height: '9rem', flexShrink: 0 }}
      />

      <div
        style={{
          position: 'relative',
          // Pulls the panel up over the image band, which is what creates the
          // overlap in the design.
          marginTop: '-1.6rem',
          borderRadius: '1.1rem 1.1rem 0 0',
          background: 'var(--color-surface)',
          padding: '0 1.15rem 1.5rem',
          textAlign: 'center',
          flexGrow: 1,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.9rem',
            height: '2.9rem',
            marginTop: '-1.45rem',
            borderRadius: '0.85rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: accent,
            boxShadow: '0 4px 14px -6px rgba(28,36,48,0.28)',
          }}
        >
          {icon}
        </span>

        <h3
          style={{
            margin: '0.85rem 0 0',
            fontFamily: 'var(--font-scripture)',
            fontSize: '1.2rem',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: '0.5rem 0 0',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--color-text-secondary)',
          }}
        >
          {description}
        </p>
      </div>
    </article>
  );
}
