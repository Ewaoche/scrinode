import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '../components/providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Scrinode',
  description: 'Bible-first, AI-assisted research and ministry workspace',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Scrinode is mobile-first and text scaling is an accessibility
  // requirement (AGENTS.md §32), so zoom is never disabled.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set per request by src/middleware.ts. next-themes needs it to run its
  // pre-paint script under a nonce-based CSP.
  const nonce = (await headers()).get('x-nonce');

  return (
    // suppressHydrationWarning is required by next-themes, which sets
    // data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers {...(nonce ? { nonce } : {})}>{children}</Providers>
      </body>
    </html>
  );
}
