import type { Citation, ZedekMessage } from '@scrinode/types';

/**
 * One message in a Conversation.
 *
 * §2.4 requires Scripture, AI synthesis and user content stay *visibly*
 * distinct, so this is not a styling preference: an assistant message is
 * marked as such, and its citations render as Scripture — in the reading
 * serif, attributed — rather than being folded into the prose.
 */
export function Message({ message }: { message: ZedekMessage }) {
  const isReader = message.role === 'user';

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        padding: '1.1rem 1.35rem',
        borderRadius: '0.9rem',
        background: isReader ? 'var(--color-surface)' : 'var(--color-scripture-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* A label, not only a colour: §32 forbids signalling state by colour
          alone, and "who said this" is exactly such a state. */}
      <p
        style={{
          margin: 0,
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: isReader ? 'var(--color-text-secondary)' : 'var(--color-accent-zedek)',
        }}
      >
        {isReader ? 'You' : 'Zedek'}
      </p>

      <div style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
        {message.content}
      </div>

      {message.citations.length > 0 ? (
        <ul
          aria-label="Citations"
          style={{ listStyle: 'none', margin: '0.35rem 0 0', padding: 0, display: 'grid', gap: '0.5rem' }}
        >
          {message.citations.map((citation, index) => (
            <li key={`${citation.retrievalUnitId ?? citation.sourceId ?? citation.label}-${index}`}>
              <CitationRow citation={citation} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/**
 * A citation, rendered as the source it is.
 *
 * Scripture is shown in the reading serif with its reference, because §1 makes
 * the Bible the foundational interface rather than a footnote to AI prose.
 */
function CitationRow({ citation }: { citation: Citation }) {
  return (
    <div
      style={{
        borderLeft: '2px solid var(--color-accent-scripture)',
        paddingLeft: '0.85rem',
      }}
    >
      {citation.text ? (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-scripture)',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            color: 'var(--color-text-primary)',
          }}
        >
          {citation.text}
        </p>
      ) : null}
      <p
        style={{
          margin: '0.3rem 0 0',
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          color: 'var(--color-text-secondary)',
        }}
      >
        {citation.label}
        {citation.translation ? ` · ${citation.translation}` : ''}
      </p>
    </div>
  );
}
