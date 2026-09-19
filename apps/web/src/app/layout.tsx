import type { Metadata, Viewport } from 'next';
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning is required by next-themes, which sets
    // data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
