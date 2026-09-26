import { Scene } from '@scrinode/ui';

/**
 * A single verse, set as a quiet band between sections.
 *
 * Scripture is the foundational interface (§1), so it appears as Scripture —
 * in the reading serif, attributed, never paraphrased. Psalm 46:10 as printed
 * in the Berean Standard Bible, which is public domain and already ingested.
 */
export function VerseBand() {
  return (
    <Scene tone="dusk" scrim="soft">
      <blockquote
        style={{
          margin: 0,
          padding: 'clamp(3rem, 7vw, 4.75rem) clamp(1.5rem, 5vw, 3rem)',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-scripture)',
            fontStyle: 'italic',
            fontSize: 'clamp(1.35rem, 3.4vw, 2rem)',
            lineHeight: 1.45,
            color: '#f7f4ec',
          }}
        >
          &ldquo;Be still, and know that I am God.&rdquo;
        </p>

        <cite
          style={{
            display: 'block',
            marginTop: '1.1rem',
            fontStyle: 'normal',
            fontSize: '0.75rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'rgba(243,240,232,0.72)',
          }}
        >
          Psalm 46:10
        </cite>

        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: '3.5rem',
            height: '1px',
            margin: '1.35rem auto 0',
            background: 'rgba(197,162,83,0.8)',
          }}
        />
      </blockquote>
    </Scene>
  );
}
