import type { DefaultSession } from 'next-auth';

/**
 * Adds the user id to the session type.
 *
 * Resource-ownership checks (AGENTS.md §33) compare against this, so it must
 * be typed rather than reached for with a cast.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
