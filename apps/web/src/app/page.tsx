import { ThemeToggle } from '../components/theme-toggle';

/**
 * Scaffold page.
 *
 * Proves the stack is wired — theming, tokens, fonts. It is NOT the Scripture
 * reader; that arrives with the UI build, when this is replaced entirely.
 */
export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '40rem', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-scripture)', fontSize: '1.75rem' }}>Scrinode</h1>

      <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>
        Scaffold. No interface has been designed yet.
      </p>

      <div style={{ marginTop: '2rem' }}>
        <ThemeToggle />
      </div>
    </main>
  );
}
