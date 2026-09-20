import { describe, expect, it } from 'vitest';
import {
  IS_COMMERCIAL_PRODUCT,
  TRANSLATIONS,
  availableTranslations,
  getTranslation,
  isAvailable,
  isKnownTranslation,
  requiredAttribution,
} from './translations.js';

/**
 * These tests guard the licensing matrix against drift.
 *
 * The registry's worth is not that it lists translations — it is that a
 * translation cannot quietly become servable without its obligations being
 * met. Most of what follows asserts that property rather than any particular
 * entry, so the guarantees survive new rows.
 */

describe('TRANSLATIONS registry', () => {
  it('has unique codes', () => {
    const codes = TRANSLATIONS.map((t) => t.code.toUpperCase());
    expect(new Set(codes).size).toBe(TRANSLATIONS.length);
  });

  it('records a publisher licence URL for every entry', () => {
    for (const translation of TRANSLATIONS) {
      expect(translation.licence.sourceUrl, translation.code).toMatch(/^https?:\/\//);
    }
  });

  it('names a rights holder for every entry', () => {
    for (const translation of TRANSLATIONS) {
      expect(translation.licence.rightsHolder.length, translation.code).toBeGreaterThan(0);
    }
  });

  it('explains every translation that is not available', () => {
    for (const translation of TRANSLATIONS) {
      if (translation.status !== 'available') {
        expect(translation.blockedReason, translation.code).toBeTruthy();
      }
    }
  });
});

describe('availability invariants', () => {
  /**
   * The core safety property. An available translation must permit commercial
   * use and full redistribution, because Scrinode stores text in its own
   * database and is not a non-commercial project.
   */
  it('only marks a translation available when its terms actually allow it', () => {
    for (const translation of availableTranslations()) {
      expect(translation.licence.commercialUse, translation.code).toBe('permitted');
      expect(translation.licence.redistribution, translation.code).toBe('full');
    }
  });

  it('never marks a translation available while an attribution obligation is unimplemented', () => {
    // Attribution rendering is not built yet. Until it is, a translation that
    // requires attribution must not be servable. When that lands, this test
    // is the thing that says so.
    for (const translation of availableTranslations()) {
      expect(translation.licence.attribution.required, translation.code).toBe(false);
    }
  });

  it('never marks a share-alike translation available without attribution handling', () => {
    for (const translation of availableTranslations()) {
      expect(translation.licence.shareAlike, translation.code).toBe(false);
    }
  });

  it('keeps every non-commercial licence out of the available set', () => {
    for (const translation of TRANSLATIONS) {
      if (translation.licence.redistribution === 'full-non-commercial') {
        expect(translation.status, translation.code).not.toBe('available');
      }
    }
  });

  /**
   * Scrinode sells subscriptions, so no non-commercial grant can ever be
   * served. This is the premise behind the commercialUse assertion above,
   * stated explicitly so that changing it requires changing a test.
   */
  it('holds the commercial premise that governs every licence decision', () => {
    expect(IS_COMMERCIAL_PRODUCT).toBe(true);

    if (IS_COMMERCIAL_PRODUCT) {
      for (const translation of availableTranslations()) {
        expect(translation.licence.commercialUse, translation.code).not.toBe('prohibited');
        expect(translation.licence.commercialUse, translation.code).not.toBe('not-stated');
      }
    }
  });

  it('requires a text source for anything servable', () => {
    for (const translation of availableTranslations()) {
      expect(translation.textSourceUrl, translation.code).toBeTruthy();
      expect(translation.formats?.length, translation.code).toBeGreaterThan(0);
    }
  });
});

describe('AI and RAG posture', () => {
  /**
   * Zedek grounds answers in retrieved Scripture (AGENTS.md §20), so silence
   * on AI use is a live question for every text we retrieve.
   *
   * This test does not demand permission — no publisher grants it. It demands
   * that anything we serve be free of copyright altogether, which is what
   * makes the silence harmless.
   */
  it('serves only texts where no copyright restricts retrieval', () => {
    for (const translation of availableTranslations()) {
      expect(translation.licence.rightsHolder, translation.code).toBe('public domain');
    }
  });

  it('does not record AI permission a publisher never granted', () => {
    for (const translation of TRANSLATIONS) {
      expect(translation.licence.aiUse, translation.code).not.toBe('permitted');
    }
  });
});

describe('getTranslation', () => {
  it('finds a translation by code', () => {
    expect(getTranslation('BSB')?.shortName).toBe('Berean Standard Bible');
  });

  it('is case-insensitive and tolerates surrounding space', () => {
    expect(getTranslation('  web ')?.code).toBe('WEB');
  });

  it('returns undefined for an unknown code', () => {
    expect(getTranslation('NIV')).toBeUndefined();
  });
});

describe('isKnownTranslation', () => {
  it('distinguishes registry membership from availability', () => {
    // The NET is known and deliberately not servable. Conflating the two is
    // how an unlicensed text reaches production.
    expect(isKnownTranslation('NET')).toBe(true);
    expect(isAvailable('NET')).toBe(false);
  });

  it('rejects a translation that was never registered', () => {
    expect(isKnownTranslation('ESV')).toBe(false);
    expect(isAvailable('ESV')).toBe(false);
  });
});

describe('isAvailable', () => {
  it('permits the public-domain texts', () => {
    expect(isAvailable('BSB')).toBe(true);
    expect(isAvailable('WEB')).toBe(true);
  });

  it('refuses a translation blocked on an unmet obligation', () => {
    expect(isAvailable('LSV')).toBe(false);
  });

  it('refuses a translation blocked on incompleteness', () => {
    expect(isAvailable('OEB')).toBe(false);
  });

  it('refuses an unknown code rather than throwing', () => {
    expect(isAvailable('ZZZ')).toBe(false);
  });
});

describe('requiredAttribution', () => {
  it('returns nothing when the licence requires none', () => {
    // The BSB carries suggested wording that is explicitly not required.
    expect(requiredAttribution('BSB')).toBeUndefined();
    expect(requiredAttribution('WEB')).toBeUndefined();
  });

  it('returns the verbatim notice when the licence requires one', () => {
    expect(requiredAttribution('LSV')).toContain('Covenant Press');
    expect(requiredAttribution('NET')).toContain('Biblical Studies Press');
  });

  it('supplies wording for every translation that requires attribution', () => {
    for (const translation of TRANSLATIONS) {
      if (translation.licence.attribution.required) {
        expect(requiredAttribution(translation.code), translation.code).toBeTruthy();
      }
    }
  });

  it('returns nothing for an unknown code', () => {
    expect(requiredAttribution('ESV')).toBeUndefined();
  });
});
