import { Features } from '../components/landing/features';
import { Hero } from '../components/landing/hero';
import { SiteFooter } from '../components/landing/site-footer';
import { VerseBand } from '../components/landing/verse-band';
import { Vision } from '../components/landing/vision';

/**
 * The coming-soon landing page.
 *
 * Replaces the scaffold. This is not the Scripture reader — §12's reader
 * arrives with the product; this page exists to explain what is coming and
 * capture interest.
 *
 * Composed entirely from @scrinode/ui primitives, so the reader can be built
 * from the same vocabulary rather than a second one.
 */
export default function Home() {
  return (
    <main id="top">
      <Hero />
      <Features />
      <VerseBand />
      <Vision />
      <SiteFooter />
    </main>
  );
}
