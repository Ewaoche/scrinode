import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WaitlistForm } from './waitlist-form';

/**
 * The only interactive element on the landing page, so it carries the states
 * §44 requires: error, loading, success — each announced, not merely shown.
 */
describe('WaitlistForm', () => {
  it('labels the field for a screen reader', () => {
    // A placeholder is not a label: it vanishes as soon as anyone types (§32).
    render(<WaitlistForm />);

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('refuses an address that cannot be one, without calling the server', async () => {
    const onSubmit = vi.fn();
    render(<WaitlistForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter an email address/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('marks the field invalid so the error is not colour-only', async () => {
    // §32: never signal state with colour alone.
    render(<WaitlistForm />);

    await userEvent.type(screen.getByLabelText('Email address'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));

    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits a trimmed address', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<WaitlistForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email address'), '  reader@example.com  ');
    await userEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('reader@example.com'));
  });

  it('confirms success and clears the field', async () => {
    render(<WaitlistForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com');
    await userEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/you are on the list/i);
    expect(screen.getByLabelText('Email address')).toHaveValue('');
  });

  it('reports a failure without leaking the underlying error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.4:5432'));
    render(<WaitlistForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com');
    await userEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));

    const alert = await screen.findByRole('alert');

    expect(alert).toHaveTextContent(/did not go through/i);
    // Infrastructure detail must never reach a reader.
    expect(alert).not.toHaveTextContent(/ECONNREFUSED|5432/);
  });

  it('clears the error as soon as the reader starts fixing it', async () => {
    render(<WaitlistForm />);

    const field = screen.getByLabelText('Email address');
    await userEvent.type(field, 'nope');
    await userEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));
    expect(field).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(field, '@example.com');
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('does not submit twice while in flight', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (release = r)));
    render(<WaitlistForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email address'), 'reader@example.com');
    const button = screen.getByRole('button', { name: /join the waitlist/i });
    await userEvent.click(button);

    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();

    release();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});
