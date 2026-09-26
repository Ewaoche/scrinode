'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from './button';
import { ArrowIcon, MailIcon } from './icons';

/**
 * Email capture for the waiting list.
 *
 * The only interactive element on the landing page, so it carries the states
 * §44 requires of any feature: idle, submitting, success and error, each
 * announced rather than merely shown.
 *
 * Validation is deliberately permissive — a single `@` with something either
 * side. Stricter client-side email regexes reject real addresses, and the
 * authority on deliverability is the confirmation email, not this field.
 */
export interface WaitlistFormProps {
  /** Submits the address. Rejecting marks the form failed. */
  readonly onSubmit?: (email: string) => Promise<void>;
  readonly placeholder?: string;
  readonly cta?: string;
}

type State = 'idle' | 'submitting' | 'done' | 'error';

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm({
  onSubmit,
  placeholder = 'Enter your email for early access',
  cta = 'Join the Waitlist',
}: WaitlistFormProps) {
  const inputId = useId();
  const statusId = useId();

  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  const invalid = state === 'error';

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!LOOKS_LIKE_EMAIL.test(email.trim())) {
      setState('error');
      setMessage('Enter an email address so we can reach you.');
      return;
    }

    setState('submitting');
    setMessage('');

    try {
      await onSubmit?.(email.trim());
      setState('done');
      setMessage('You are on the list. We will be in touch before launch.');
      setEmail('');
    } catch {
      setState('error');
      // Never surfaces the underlying error: it is not actionable by a reader
      // and may carry detail that should not be shown.
      setMessage('That did not go through. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: '100%', maxWidth: '38rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          padding: '0.4rem 0.4rem 0.4rem 1.1rem',
          borderRadius: '999px',
          background: 'rgba(12,17,26,0.55)',
          border: `1px solid ${invalid ? 'rgba(224,123,123,0.75)' : 'rgba(255,255,255,0.20)'}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'rgba(243,240,232,0.6)' }}>
          <MailIcon />
        </span>

        {/* Visually hidden rather than absent: a placeholder is not a label,
            and disappears as soon as anyone types (§32). */}
        <label
          htmlFor={inputId}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          Email address
        </label>

        <input
          id={inputId}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={placeholder}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (state === 'error') setState('idle');
          }}
          aria-invalid={invalid}
          aria-describedby={message ? statusId : undefined}
          disabled={state === 'submitting'}
          style={{
            flex: '1 1 14rem',
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#f3f0e8',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.9375rem',
            padding: '0.7rem 0',
          }}
        />

        <Button type="submit" variant="gold" size="md" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Joining…' : cta}
          <span aria-hidden="true" style={{ display: 'inline-flex' }}>
            <ArrowIcon width={18} height={18} />
          </span>
        </Button>
      </div>

      {/* Always rendered, so a screen reader observes the region rather than
          discovering it. role=status announces politely; an error uses alert. */}
      <p
        id={statusId}
        role={invalid ? 'alert' : 'status'}
        aria-live={invalid ? 'assertive' : 'polite'}
        style={{
          margin: '0.75rem 0 0',
          minHeight: '1.25rem',
          fontSize: '0.8125rem',
          lineHeight: 1.5,
          color: invalid ? '#f0a8a8' : 'rgba(243,240,232,0.72)',
        }}
      >
        {message}
      </p>
    </form>
  );
}
