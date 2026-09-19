'use client';

import { ThemeProvider } from 'next-themes';
import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { makeAdminStore, type AdminStore } from '../store';

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AdminStore>(undefined);

  storeRef.current ??= makeAdminStore();

  return (
    <Provider store={storeRef.current}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </Provider>
  );
}
