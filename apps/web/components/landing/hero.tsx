'use client';

import { Button, Scene, WaitlistForm, BellIcon } from '@scrinode/ui';
import { SiteHeader } from './site-header';

/**
 * The hero.
 *
 * `image` is intentionally unset. The design calls for Jerusalem at golden
 * hour; the gradient treatment behind it is built to stand on its own until
 * licensed photography exists (§21 — provenance applies to imagery too, and an
 * unattributed photograph is not shippable).
 */
export function Hero({ onJoin }: { onJoin?: (email: string) => Promise<void> }) {
  return (
    <Scene tone="dawn" scrim="strong" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />

      <div
        id="waitlist"
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(2.5rem, 7vw, 5.5rem) clamp(1rem, 4vw, 3rem) clamp(3.5rem, 8vw, 6rem)',
          maxWidth: '68rem',
          width: '100%',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(243,240,232,0.74)',
          }}
        >
          A deeper tomorrow begins here
        </p>

        <h1
          style={{
            margin: '1.1rem 0 0',
            fontFamily: 'var(--font-scripture)',
            fontWeight: 400,
            fontSize: 'clamp(3rem, 9vw, 5.75rem)',
            lineHeight: 1.02,
            letterSpacing: '-0.02em',
            color: '#f7f4ec',
            textShadow: '0 2px 24px rgba(8,12,20,0.45)',
          }}
        >
          Scrinode
        </h1>

        <p
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            margin: '1.25rem 0 0',
            padding: '0.6rem 1.75rem',
            borderRadius: '999px',
            border: '1px solid rgba(197,162,83,0.65)',
            background: 'rgba(16,21,31,0.35)',
            fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
            fontWeight: 600,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#e3c884',
          }}
        >
          Coming Soon
        </p>

        <p
          style={{
            margin: '1.9rem 0 0',
            maxWidth: '34rem',
            fontSize: 'clamp(1.05rem, 2vw, 1.3rem)',
            lineHeight: 1.6,
            color: 'rgba(243,240,232,0.9)',
          }}
        >
          Bible-first study. AI-powered research. Tools to help you read,
          understand, and live God&rsquo;s Word more deeply.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.85rem',
            flexWrap: 'wrap',
            marginTop: '2.1rem',
          }}
        >
          {onJoin ? <WaitlistForm onSubmit={onJoin} /> : <WaitlistForm />}

          <Button variant="ghost" size="lg" icon={<BellIcon width={18} height={18} />}>
            Get Updates
          </Button>
        </div>

        <p
          style={{
            margin: '1.1rem 0 0',
            fontSize: '0.8125rem',
            color: 'rgba(243,240,232,0.66)',
          }}
        >
          Be the first to know when Scrinode launches. No spam, just meaningful updates.
        </p>
      </div>
    </Scene>
  );
}
