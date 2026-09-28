import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '../components/providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Zedek — Scrinode',
  description: 'Scripture-grounded AI research. Studies, conversations and citations.',
  // Zedek holds a reader's private research. It is not public content.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Text scaling is an accessibility requirement (§32), so zoom is never
  // disabled — least of all on a surface whose whole content is reading.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Set per request by middleware.ts. next-themes needs it to run its
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
