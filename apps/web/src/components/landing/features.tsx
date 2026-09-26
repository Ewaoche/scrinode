import {
  BookIcon,
  FeatureCard,
  LibraryIcon,
  SectionHeading,
  StudyIcon,
  WorkIcon,
  ZedekIcon,
} from '@scrinode/ui';

/**
 * The five product domains (§3).
 *
 * Descriptions are drawn from §3's own wording rather than invented marketing,
 * and the accents are §6's semantic mapping: Scripture navy, Study olive,
 * Zedek gold, Work slate, Library warm stone.
 */
const DOMAINS = [
  {
    title: 'Scripture',
    description: 'Read and explore the Bible with clarity and context.',
    icon: <BookIcon />,
    accent: 'var(--color-accent-scripture)',
    tone: 'dawn' as const,
  },
  {
    title: 'Study',
    description: 'Go deeper with study guides, devotionals, and trusted resources.',
    icon: <StudyIcon />,
    accent: 'var(--color-accent-study)',
    tone: 'parchment' as const,
  },
  {
    title: 'Zedek AI',
    description: 'Ask. Learn. Discover. AI-powered research grounded in Scripture.',
    icon: <ZedekIcon />,
    accent: 'var(--color-accent-zedek)',
    tone: 'dawn' as const,
  },
  {
    title: 'Workspaces',
    description: 'Plan, organize, and study together.',
    icon: <WorkIcon />,
    accent: 'var(--color-accent-work)',
    tone: 'dusk' as const,
  },
  {
    title: 'Library',
    description: 'Your resources in one place — notes, books, highlights, and more.',
    icon: <LibraryIcon />,
    accent: 'var(--color-accent-library)',
    tone: 'depth' as const,
  },
];

export function Features() {
  return (
    <section
      id="features"
      style={{
        position: 'relative',
        // Lifts the panel over the hero, which is the overlap in the design.
        marginTop: '-3rem',
        borderRadius: '1.75rem 1.75rem 0 0',
        background: 'var(--color-background)',
        padding: 'clamp(3rem, 6vw, 4.5rem) clamp(1rem, 4vw, 3rem)',
      }}
    >
      <SectionHeading
        eyebrow="Built for a deeper tomorrow"
        title="Everything You Need for a Richer Bible Study"
        description="Scripture, study tools, AI-powered research, personal workspaces, and a library — all in one place, designed to help you grow in faith and make a greater impact."
      />

      {/* auto-fit rather than fixed columns: five cards reflow to 1, 2 or 3 per
          row without a breakpoint per layout (§5). */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(13.5rem, 1fr))',
          gap: '1.1rem',
          maxWidth: '76rem',
          margin: 'clamp(2.25rem, 5vw, 3.25rem) auto 0',
        }}
      >
        {DOMAINS.map((domain) => (
          <FeatureCard key={domain.title} {...domain} />
        ))}
      </div>
    </section>
  );
}
