import { SignInForm } from '../../components/signin-form';

/**
 * Sign-in.
 *
 * Deliberately unstyled scaffolding proving the auth flow works. Replaced
 * when the interface is designed.
 */
export default function SignIn() {
  return (
    <main style={{ padding: '2rem', maxWidth: '24rem', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-scripture)', fontSize: '1.5rem' }}>Sign in</h1>
      <SignInForm />
    </main>
  );
}
