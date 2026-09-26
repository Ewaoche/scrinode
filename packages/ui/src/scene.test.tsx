import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Scene } from './scene';

/**
 * The scrim is what makes text over a photograph readable (§32). It is a
 * background layer, so nothing else would catch its removal — a page would
 * simply ship with pale text on a bright sky.
 */
describe('Scene', () => {
  const layers = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[aria-hidden="true"]'));

  it('always paints a gradient, so a missing image is not a blank box', () => {
    const { container } = render(<Scene tone="dawn" />);

    const painted = layers(container).some((el) =>
      (el as HTMLElement).style.background.includes('gradient'),
    );

    expect(painted).toBe(true);
  });

  it('lays a scrim between an image and the content', () => {
    const { container } = render(<Scene image="/photo.jpg" scrim="strong">text</Scene>);

    const backgrounds = layers(container).map((el) => (el as HTMLElement).style.background);

    // The image layer and a darkening layer above it.
    expect(
      layers(container).some((el) => (el as HTMLElement).style.backgroundImage.includes('photo')),
    ).toBe(true);
    expect(backgrounds.some((bg) => bg.includes('rgba(16, 21, 31'))).toBe(true);
  });

  it('hides every decorative layer from assistive technology', () => {
    // A backdrop announced as an image is noise; the meaning is in the text.
    const { container } = render(<Scene image="/photo.jpg">content</Scene>);

    for (const layer of layers(container)) {
      expect(layer).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders its children above the layers', () => {
    const { getByText } = render(<Scene>Scripture</Scene>);

    expect(getByText('Scripture')).toBeInTheDocument();
  });

  it('veils a photograph more heavily than it scrims a hero', () => {
    // Small text needs the image to recede further than a headline does
    // (§32 sets a higher contrast bar below 18pt), so the footer's veil must
    // be the heavier of the two rather than merely different.
    const opacity = (scrim: 'strong' | 'veil') => {
      const { container } = render(<Scene image="/p.jpg" scrim={scrim} />);
      const values = layers(container)
        .map((el) => (el as HTMLElement).style.background)
        .join(' ')
        .match(/rgba\([\d\s,]+?,\s*([\d.]+)\)/g);
      return Math.min(...(values ?? []).map((v) => Number(v.match(/([\d.]+)\)$/)?.[1] ?? 1)));
    };

    // Compare the *lightest* point of each: a directional scrim is only as
    // good as the spot where it lets the most light through.
    expect(opacity('veil')).toBeGreaterThan(opacity('strong'));
  });

  it('omits the scrim only when explicitly asked', () => {
    const { container } = render(<Scene scrim="none" />);

    const scrims = layers(container).filter((el) =>
      (el as HTMLElement).style.background.includes('rgba(16, 21, 31'),
    );

    expect(scrims).toHaveLength(0);
  });
});
