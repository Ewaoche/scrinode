'use client';

import { Button, SectionHeading } from '@scrinode/ui';
import type { Study } from '@scrinode/types';

/**
 * The Studies index.
 *
 * Scaffold: it renders the empty state, which §44 requires of any feature and
 * which is the state a new reader actually sees first. Studies arrive from the
 * API once `GET /zedek/studies` exists; nothing here fabricates one.
 */
export function StudyList({ studies = [] }: { studies?: readonly Study[] }) {
  return (
    <main
      style={{
        maxWidth: '62rem',
        margin: '0 auto',
        padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2.5rem)',
      }}
    >
      <SectionHeading
        eyebrow="Zedek"
        title="Your Studies"
        description="A Study holds one body of research — a sermon series, a book, a question. Conversations live inside it, and what you establish is remembered across them."
        align="left"
      />

      <div style={{ marginTop: '2rem' }}>
        <Button variant="gold" size="md">
          Start a Study
        </Button>
      </div>

      {studies.length === 0 ? (
        <p
          style={{
            marginTop: '2.5rem',
            padding: '2.5rem',
            borderRadius: '1rem',
            border: '1px dashed var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            lineHeight: 1.7,
          }}
        >
          No studies yet. Start one to begin researching a passage, a theme or a
          question — Zedek answers from Scripture and your own notes, with
          citations you can check.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '2rem 0 0', display: 'grid', gap: '0.75rem' }}>
          {studies.map((study) => (
            <li key={study.id}>
              <article
                style={{
                  padding: '1.15rem 1.35rem',
                  borderRadius: '0.9rem',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-scripture)',
                    fontSize: '1.15rem',
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {study.title}
                </h2>
                {study.description ? (
                  <p
                    style={{
                      margin: '0.4rem 0 0',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {study.description}
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
