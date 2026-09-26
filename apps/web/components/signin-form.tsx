'use client';

import { signIn } from 'next-auth/react';
import { useState, type FormEvent } from 'react';

const field: React.CSSProperties = {
  width: '100%',
  minHeight: '2.75rem',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--color-border)',
  borderRadius: '0.375rem',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
};

const button: React.CSSProperties = {
  ...field,
  background: 'var(--color-action)',
  color: 'var(--color-action-text)',
  cursor: 'pointer',
};

/**
 * Sign-in form.
 *
 * Scaffolding, not designed UI. Accessibility is still honoured here because
 * it is a product requirement rather than a polish step (AGENTS.md §32):
 * labelled inputs, 44px targets, and status announced to screen readers.
 */
export function SignInForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      await signIn('email', { email, redirect: false });
      // Always report success, so the form cannot be used to discover which
      // addresses have accounts.
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
      <button type="button" style={button} onClick={() => void signIn('google')}>
        Continue with Google
      </button>

      <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: '0.75rem' }}>
        <label htmlFor="email" style={{ color: 'var(--color-text-secondary)' }}>
          Email address
        </label>

        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={field}
        />

        <button type="submit" style={button} disabled={pending}>
          {pending ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      </form>

      <p role="status" aria-live="polite" style={{ color: 'var(--color-text-secondary)' }}>
        {sent ? 'If that address has an account, a sign-in link is on its way.' : ''}
      </p>
    </div>
  );
}
