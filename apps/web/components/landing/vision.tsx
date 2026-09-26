import { LeafMark, Scene, SectionHeading, WorkIcon } from '@scrinode/ui';

const PILLARS = [
  { icon: <LeafMark width={22} height={22} />, label: 'Deeper\nUnderstanding' },
  { icon: <WorkIcon width={22} height={22} />, label: 'Stronger\nCommunity' },
  { icon: <MountainMark />, label: 'A Brighter\nTomorrow' },
];

/** A horizon, for the third pillar. Local: nothing else uses it. */
function MountainMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5.5 21.5 19h-19L12 5.5Z" opacity="0.85" />
    </svg>
  );
}

export function Vision() {
  return (
    <Scene tone="depth" scrim="strong">
      <div
        id="vision"
        style={{
          padding: 'clamp(3.5rem, 8vw, 6rem) clamp(1rem, 4vw, 3rem)',
          maxWidth: '68rem',
        }}
      >
        <SectionHeading
          eyebrow="Something greater is coming"
          title={
            <>
              Preparing a deeper way
              <br />
              to study Scripture.
            </>
          }
          description="Scrinode is on the way — a modern, faithful platform to help you explore God's Word, gain insight, and grow in faith for a brighter tomorrow."
          align="left"
          tone="light"
        />

        <ul
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(1.5rem, 5vw, 3.5rem)',
            listStyle: 'none',
            margin: 'clamp(2.25rem, 5vw, 3rem) 0 0',
            padding: 0,
          }}
        >
          {PILLARS.map((pillar) => (
            <li
              key={pillar.label}
              style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}
            >
              <span aria-hidden="true" style={{ color: '#c5a253', display: 'inline-flex' }}>
                {pillar.icon}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  lineHeight: 1.7,
                  color: 'rgba(243,240,232,0.88)',
                  whiteSpace: 'pre-line',
                }}
              >
                {pillar.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Scene>
  );
}
