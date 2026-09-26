import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../components/providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Scrinode Backoffice',
  description: 'Internal operations',
  // Internal tooling must never be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
