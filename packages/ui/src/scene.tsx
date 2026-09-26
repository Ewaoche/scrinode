import type { CSSProperties, ReactNode } from 'react';

/**
 * The atmospheric backdrop behind a section.
 *
 * Scrinode's visual direction is scholarly, calm and reverent (AGENTS.md §6),
 * which in practice means a photographic backdrop — Jerusalem at golden hour,
 * olive branches, an open book in warm light — with text laid over it.
 *
 * Two things follow from that, and both are why this component exists rather
 * than a plain `<div style={{ backgroundImage }}>`:
 *
 *   1. **Text over a photograph is a contrast problem.** §32 targets WCAG 2.2
 *      AA, and a photograph's luminance varies across its own area, so a
 *      contrast ratio measured against one pixel means nothing. Every scene
 *      therefore lays a scrim between the image and the content, and the scrim
 *      is not optional.
 *
 *   2. **The image is a slot, not a hard-coded asset.** `image` may be absent,
 *      and the gradient treatment beneath is designed to stand on its own
 *      rather than read as a missing asset. Supplying real photography later
 *      is one prop, with no layout change.
 */
export type SceneTone = 'dawn' | 'dusk' | 'parchment' | 'depth';

export interface SceneProps {
  /** Which palette the gradient treatment uses. */
  readonly tone?: SceneTone;
  /** Optional photograph. Absent is a supported, designed state. */
  readonly image?: string;
  /** How heavily to darken the image so overlaid text stays legible. */
  readonly scrim?: 'none' | 'soft' | 'strong' | 'veil';
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

/**
 * Gradient treatments.
 *
 * Each is built from the §6 palette rather than invented: brand ink, brand
 * gold and the warm neutrals. They read as light falling through an opening —
 * the recurring motif in the design — rather than as decorative colour.
 */
const TONES: Record<SceneTone, string> = {
  // Sunrise over a horizon. The warm core sits low, as a sun would.
  dawn: [
    'radial-gradient(120% 90% at 72% 78%, rgba(197,162,83,0.42) 0%, rgba(197,162,83,0) 58%)',
    'radial-gradient(90% 70% at 20% 20%, rgba(53,80,112,0.35) 0%, rgba(53,80,112,0) 62%)',
    'linear-gradient(170deg, #172033 0%, #1d2a42 44%, #33405c 100%)',
  ].join(','),

  // Later light: deeper blues, the gold pushed to an edge.
  dusk: [
    'radial-gradient(100% 80% at 88% 18%, rgba(209,179,99,0.30) 0%, rgba(209,179,99,0) 55%)',
    'linear-gradient(200deg, #10151f 0%, #172033 52%, #22304a 100%)',
  ].join(','),

  // The reading surface: warm, paper-like, almost no contrast movement.
  parchment: [
    'radial-gradient(90% 70% at 50% 0%, rgba(197,162,83,0.10) 0%, rgba(197,162,83,0) 60%)',
    'linear-gradient(180deg, #fcfaf5 0%, #f8f7f3 100%)',
  ].join(','),

  // For a band that must recede behind whatever sits on it.
  depth: 'linear-gradient(180deg, #10151f 0%, #172033 100%)',
};

/**
 * Scrim strengths.
 *
 * `strong` is directional — it darkens hardest on the left, where a hero's
 * headline sits, and lets the photograph breathe on the right. `veil` is flat
 * and heavier, for small text: §32's contrast requirement is stricter below
 * 18pt, so a footer's 13px links need the image to recede further than a
 * 5rem headline does.
 */
const SCRIMS: Record<'none' | 'soft' | 'strong' | 'veil', string | undefined> = {
  none: undefined,
  soft: 'linear-gradient(180deg, rgba(16,21,31,0.55) 0%, rgba(16,21,31,0.38) 55%, rgba(16,21,31,0.62) 100%)',
  strong:
    'linear-gradient(100deg, rgba(16,21,31,0.90) 0%, rgba(16,21,31,0.72) 42%, rgba(16,21,31,0.45) 100%)',
  veil: 'linear-gradient(180deg, rgba(13,18,27,0.90) 0%, rgba(13,18,27,0.93) 100%)',
};

export function Scene({
  tone = 'dawn',
  image,
  scrim = 'soft',
  className,
  style,
  children,
}: SceneProps) {
  const scrimLayer = SCRIMS[scrim];

  return (
    <div
      className={className}
      style={{ position: 'relative', isolation: 'isolate', ...style }}
    >
      {/* The gradient treatment. Always present: it is what the design falls
          back to, and what tints the photograph when one is supplied. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -3,
          background: TONES[tone],
        }}
      />

      {image ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : null}

      {scrimLayer ? (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, zIndex: -1, background: scrimLayer }}
        />
      ) : null}

      {children}
    </div>
  );
}
