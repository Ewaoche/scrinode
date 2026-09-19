import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { buildAuthOptions } from '../../../../auth/options';

/**
 * Reader authentication routes.
 *
 * Options are built per request rather than at module scope, so a missing
 * NEXTAUTH_SECRET fails the request that needs it rather than the build.
 *
 * Admin authentication is a separate system on a separate domain
 * (AGENTS.md §27.2) and must never be served from here.
 */
async function handler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  return NextAuth(buildAuthOptions())(request, context);
}

export { handler as GET, handler as POST };

// Auth.js needs Node APIs; it cannot run on the edge runtime.
export const runtime = 'nodejs';
