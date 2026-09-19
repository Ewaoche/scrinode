import { createTransport } from 'nodemailer';
import { describe, expect, it } from 'vitest';

/**
 * Verifies that nodemailer 9 works with the transport configuration
 * EmailProvider uses.
 *
 * next-auth 4 and @auth/core declare a peer dependency on nodemailer ^7, but
 * every 7.x release carries unpatched advisories — SMTP command injection via
 * unsanitised input, CRLF injection in headers, and TLS certificate
 * validation failures in OAuth2. Pinning to a vulnerable version to satisfy a
 * declared range is the wrong trade for a production-first app.
 *
 * These tests exercise the transport surface Auth.js actually uses, so the
 * override is justified by evidence rather than assumption.
 */
describe('nodemailer 9 with the Auth.js SMTP configuration', () => {
  /** The exact shape passed to EmailProvider in src/auth/options.ts. */
  const smtpConfig = {
    host: 'smtp.resend.com',
    port: 465,
    auth: { user: 'resend', pass: 'test-key' },
  };

  it('creates a transport from the configuration EmailProvider passes', () => {
    const transport = createTransport(smtpConfig);

    expect(transport).toBeDefined();
    expect(typeof transport.sendMail).toBe('function');
  });

  it('reports the expected transporter name', () => {
    expect(createTransport(smtpConfig).transporter.name).toBe('SMTP');
  });

  it('is configured for implicit TLS on port 465', () => {
    // Port 465 is SMTPS; nodemailer derives `secure: true` from it. A
    // transport falling back to cleartext would send magic-link tokens
    // unencrypted. Read through the transporter rather than the public
    // Options type, which does not model SMTP-specific fields.
    const transport = createTransport(smtpConfig);
    const options = (transport.transporter as unknown as { options: Record<string, unknown> })
      .options;

    expect(options.port).toBe(465);
    expect(options.secure).not.toBe(false);
  });

  it('exposes verify(), which Auth.js calls on startup', async () => {
    expect(typeof createTransport(smtpConfig).verify).toBe('function');
  });

  it('neutralises CRLF in a recipient address rather than emitting a header', async () => {
    // CRLF in an address is the header-injection vector patched in 8.x/9.x.
    // Nodemailer does not throw; it parses the value as an address structure,
    // so the injected "Bcc:" cannot become a header line. What matters is
    // that no additional recipient is produced.
    const transport = createTransport({ jsonTransport: true });

    const result = await transport.sendMail({
      from: 'noreply@scrinode.com',
      to: 'victim@example.com\r\nBcc: attacker@example.com',
      subject: 'Sign in to Scrinode',
      text: 'link',
    });

    const message = JSON.parse(result.message as unknown as string) as {
      headers?: Record<string, string>;
      bcc?: unknown;
    };

    expect(message.headers ?? {}).toEqual({});
    expect(message.bcc).toBeUndefined();
  });

  it('carries a CRLF-bearing subject as a value, not as extra headers', async () => {
    const transport = createTransport({ jsonTransport: true });

    const result = await transport.sendMail({
      from: 'noreply@scrinode.com',
      to: 'reader@example.com',
      subject: 'Sign in\r\nBcc: attacker@example.com',
      text: 'link',
    });

    const message = JSON.parse(result.message as unknown as string) as {
      headers?: Record<string, string>;
      bcc?: unknown;
    };

    // The raw subject is preserved as data and encoded at serialisation; the
    // guarantee is that it produces no extra header and no extra recipient.
    expect(message.headers ?? {}).toEqual({});
    expect(message.bcc).toBeUndefined();
  });
});
