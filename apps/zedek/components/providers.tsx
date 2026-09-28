'use client';

import { ThemeProvider } from 'next-themes';
import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeStore, type AppStore } from '../store';

/**
 * Client providers.
 *
 * The store is created once per client via a ref rather than at module scope,
 * so server rendering cannot share one store between requests.
 */
export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const storeRef = useRef<AppStore>(undefined);

  storeRef.current ??= makeStore();

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        {...(nonce ? { nonce } : {})}
      >
        {children}
      </ThemeProvider>
    </Provider>
  );
}
