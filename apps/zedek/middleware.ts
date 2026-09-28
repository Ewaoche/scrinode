import { NextResponse, type NextRequest } from 'next/server';

/**
 * Per-request Content Security Policy with a nonce.
 *
 * Scrinode renders Scripture, user notes and — soon — AI output. All three are
 * untrusted as markup, so script execution must be confined to the app's own
 * bundle (AGENTS.md §33).
 *
 * A nonce rather than 'unsafe-inline': next-themes needs one inline script to
 * set the theme before first paint, and allowing all inline scripts to permit
 * that one would defeat the policy entirely. The nonce authorises exactly
 * that script and nothing else.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bundle load its own chunks without
    // enumerating them. Development additionally needs eval for fast refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Next.js injects inline style tags it does not nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
  ].join('; ');

  // Passed through the request so the rendered document can read it.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation: they are not documents and
    // gain nothing from a per-request policy.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
