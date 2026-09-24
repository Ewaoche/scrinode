import PostgresAdapter from '@auth/pg-adapter';
import type { NextAuthOptions } from 'next-auth';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import { getPool } from './pg-pool';

/**
 * Reader authentication — AGENTS.md §27.1.
 *
 * This is READER identity only. Admin identity is a separate security domain
 * with its own tables, sessions, cookie and domain (§27.2, §27.3): a
 * compromised reader account must never be able to reach the backoffice.
 * Nothing here may be reused for admin auth.
 *
 * Providers are registered only when configured, so a deployment can run with
 * Google, email, or both. The environment schema guarantees at least one.
 */
function buildProviders(): NextAuthOptions['providers'] {
  const providers: NextAuthOptions['providers'] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    providers.push(
      EmailProvider({
        from: process.env.EMAIL_FROM,
        // Resend's SMTP bridge. Notifications go through the provider
        // abstraction (AGENTS.md §28); this is Auth.js's own magic-link
        // transport and is deliberately separate from that service.
        server: {
          host: 'smtp.resend.com',
          port: 465,
          auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
        },
      }),
    );
  }

  return providers;
}

/**
 * Builds the options.
 *
 * A function rather than a module-level constant so environment checks run
 * per request rather than at import. Throwing at module scope would break
 * `next build`, which evaluates route modules without runtime secrets
 * present — and would tie a configuration error to the build rather than to
 * the deployment that is actually misconfigured.
 */
export function buildAuthOptions(): NextAuthOptions {
  return {
    // The adapter owns `users`, `accounts`, `sessions` and
    // `verification_token`, created by migration 0003. It issues raw SQL
    // against those names, so neither the tables nor their camelCase columns
    // may be renamed.
    adapter: PostgresAdapter(getPool()),

    providers: buildProviders(),

    session: {
      strategy: 'database',
      // Thirty days. Readers should not be signed out mid-study; admin
      // sessions are deliberately much shorter (§27.2).
      maxAge: 30 * 24 * 60 * 60,
    },

    pages: {
      signIn: '/signin',
    },

    callbacks: {
      /**
       * Exposes the user id on the session so resource-ownership checks have
       * something to compare against (AGENTS.md §33).
       */
      session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
        }
        return session;
      },
    },

    // Secure cookies are the Auth.js default in production. Never log the
    // secret or session tokens.
    //
    // Unlike the database name, this has no safe fallback: a missing or
    // guessed signing secret means forgeable sessions. Fail loudly.
    secret: requireSecret(),
  };
}

function requireSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'NEXTAUTH_SECRET must be set and at least 32 characters. ' +
        'Generate one with: openssl rand -base64 32',
    );
  }

  return secret;
}
