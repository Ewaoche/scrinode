import type { LicenceTerms, TranslationCode } from '@scrinode/types';

/**
 * Translation registry — the licensing matrix in machine-readable form.
 *
 * `TranslationCode` is a branded type with, until now, nothing behind it: any
 * string could be cast to one. This registry is to `TranslationCode` what
 * `books.ts` is to `BookId` — the known set, and the terms that govern each
 * member.
 *
 * Every entry's terms were read from the publisher's own licence page. The
 * sourced write-up, including the claims we could NOT verify, is in
 * `docs/TRANSLATION_LICENSING.md`. AGENTS.md §42 forbids inventing licensing
 * terms: if a publisher is silent, the field says `'not-stated'` and the
 * translation does not ship until someone resolves it.
 *
 * Adding a translation here does NOT make it available. `status` does, and
 * `isAvailable` is the only thing that should gate serving text.
 */

/**
 * Whether Scrinode may serve this text today.
 *
 * The three tiers have very different unblock times, and conflating them is
 * how an unlicensed text reaches production. A licensed version cannot become
 * `available` by editing this file — it needs a signed agreement first.
 */
export type TranslationStatus =
  /** Terms verified and satisfied. May be served. */
  | 'available'
  /** Terms verified and permissive, but an obligation is not yet implemented. */
  | 'pending-implementation'
  /** Requires an agreement Scrinode does not hold. */
  | 'requires-agreement'
  /** Terms forbid Scrinode's use, or could not be verified. */
  | 'blocked';

export interface TranslationMeta {
  readonly code: TranslationCode;
  /** Full published name, as the publisher writes it. */
  readonly name: string;
  /** Short label for the translation selector. */
  readonly shortName: string;
  readonly language: string;
  readonly status: TranslationStatus;
  readonly licence: LicenceTerms;
  /** Where machine-readable text is obtained, for ingestion (AGENTS.md §21). */
  readonly textSourceUrl?: string;
  /** Formats available at `textSourceUrl`, e.g. `USFM`, `USX`. */
  readonly formats?: readonly string[];
  /** Why this translation is not `available`. Required when it is not. */
  readonly blockedReason?: string;
}

/**
 * Scrinode is a commercial product.
 *
 * Confirmed by the product owner: no advertising, but paid subscription plans.
 * Every publisher treats a subscription as commercial use, and several define
 * it broadly enough that even donation prompts would qualify. This rules out
 * every non-commercial grant — the free ESV API, API.Bible's free tier, the
 * NET's gratis licence and Bible Brain all require the text to be given away.
 *
 * This constant exists so that premise is enforced rather than remembered:
 * `translations.test.ts` asserts no translation marked available carries a
 * non-commercial licence. If Scrinode ever ceased to be commercial, flipping
 * this would be a deliberate act with visible consequences.
 */
export const IS_COMMERCIAL_PRODUCT = true;

const code = (value: string): TranslationCode => value as TranslationCode;

/**
 * Terms for a text eBible.org distributes with the copyright field reading
 * exactly "public domain".
 *
 * These texts are old enough that copyright has lapsed, so there is nothing
 * to permit or refuse: no fee, no cap, no attribution, no share-alike, and
 * no copyright that could restrict retrieval into a model's context.
 *
 * Written once rather than repeated per entry (AGENTS.md §42). Anything whose
 * terms differ in any respect spells them out in full instead of calling this.
 */
const ebiblePublicDomain = (translationId: string): LicenceTerms => ({
  name: 'Public domain',
  sourceUrl: `https://ebible.org/Scriptures/details.php?id=${translationId}`,
  rightsHolder: 'public domain',
  commercialUse: 'permitted',
  redistribution: 'full',
  limits: { completeBookPermitted: true },
  attribution: { required: false },
  aiUse: 'not-stated',
  shareAlike: false,
});

/** USFM archive for an eBible.org translation. */
const ebibleUsfm = (translationId: string): string =>
  `https://ebible.org/Scriptures/${translationId}_usfm.zip`;

const EBIBLE_FORMATS = ['USFM', 'USFX', 'TXT', 'SQL'] as const;

/**
 * Public-domain and open-licence English translations.
 *
 * Ordered by how freely Scrinode may use them, most free first.
 */
export const TRANSLATIONS: readonly TranslationMeta[] = [
  {
    code: code('BSB'),
    name: 'The Holy Bible, Berean Standard Bible',
    shortName: 'Berean Standard Bible',
    language: 'en',
    status: 'available',
    textSourceUrl: 'https://berean.bible/downloads.htm',
    formats: ['USFM', 'USJ', 'USX', 'TXT', 'XLSX'],
    licence: {
      name: 'Public domain (dedicated)',
      sourceUrl: 'https://berean.bible/terms.htm',
      rightsHolder: 'public domain',
      commercialUse: 'permitted',
      redistribution: 'full',
      limits: { completeBookPermitted: true },
      attribution: {
        required: false,
        // Publisher labels this "appreciated but not required". Scrinode
        // displays it anyway: §21 provenance is a product value, not a
        // grudging compliance minimum.
        text:
          'The Holy Bible, Berean Standard Bible, BSB is produced in cooperation ' +
          'with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible ' +
          'Translation Committee. This text of God’s Word has been dedicated ' +
          'to the public domain.',
      },
      aiUse: 'not-stated',
      shareAlike: false,
      namingConstraint:
        'The publisher requests that the Berean name not be used for derivative ' +
        'works that vary from the official text. Verbatim text may bear the name.',
      notes: [
        'Publisher wording is a public-domain dedication; some third parties describe it as CC0.',
        'Ships first-class JSON (USJ), which no other candidate does.',
      ],
    },
  },
  {
    code: code('WEB'),
    name: 'World English Bible',
    shortName: 'World English Bible',
    language: 'en',
    status: 'available',
    textSourceUrl: 'https://ebible.org/find/details.php?id=engwebp',
    formats: ['USFM', 'USFX', 'TXT', 'SQL'],
    licence: {
      name: 'Public domain',
      sourceUrl: 'https://worldenglish.bible/',
      rightsHolder: 'public domain',
      commercialUse: 'permitted',
      redistribution: 'full',
      limits: { completeBookPermitted: true },
      attribution: { required: false },
      aiUse: 'not-stated',
      shareAlike: false,
      // Public domain removes copyright. It does not remove a trademark, and
      // this is the one live constraint on the WEB.
      namingConstraint:
        '"World English Bible" is a trademark of eBible.org and may identify only ' +
        'faithful copies of the public-domain translation published there. ' +
        'Modified text must be published under a different name.',
      notes: [
        'Publisher states plain public domain and does not use a CC0 instrument.',
        'engwebp is the Protestant-canon edition; editions differ by canon and spelling, not licence.',
      ],
    },
  },
  {
    code: code('OEB'),
    name: 'Open English Bible',
    shortName: 'Open English Bible',
    language: 'en',
    status: 'blocked',
    textSourceUrl: 'https://openenglishbible.org/',
    formats: ['USFM', 'TXT', 'EPUB'],
    blockedReason:
      'Licence is maximally permissive, but the translation is incomplete. ' +
      "eBible.org's catalogue reports 17 of 39 Old Testament books (engoebus, " +
      'verified 2026-09-20). The reader must handle missing books before this ' +
      'can be offered.',
    licence: {
      name: 'CC0 1.0',
      sourceUrl: 'https://openenglishbible.org/faq/',
      rightsHolder: 'public domain',
      commercialUse: 'permitted',
      redistribution: 'full',
      limits: { completeBookPermitted: true },
      attribution: { required: false },
      aiUse: 'not-stated',
      shareAlike: false,
      notes: [
        'Publisher requests, explicitly NOT as a licence condition, that altered versions carry another name.',
        'Blocked on completeness, not on terms.',
      ],
    },
  },
  // --- Historic public-domain translations -------------------------------
  //
  // Copyright has lapsed on all of these, so they carry no obligations at
  // all. eBible.org's catalogue records each one's copyright field as exactly
  // "public domain" and distributes each as a USFM archive (verified
  // 2026-09-20).
  //
  // These are a deliberate selection, not the whole catalogue. eBible.org
  // publishes 34 public-domain English texts; most are regional editions,
  // Septuagint translations or partial Bibles. A translation selector listing
  // 34 entries is a worse product than one listing eight, and every entry is
  // a maintenance commitment, so the rest stay out until asked for.
  {
    code: code('KJV'),
    name: 'King James (Authorized) Version',
    shortName: 'King James Version',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('eng-kjv2006'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('eng-kjv2006'),
  },
  {
    code: code('ASV'),
    name: 'American Standard Version (1901)',
    shortName: 'American Standard Version',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('eng-asv'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('eng-asv'),
  },
  {
    code: code('YLT'),
    name: "Young's Literal Translation",
    shortName: "Young's Literal",
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('engylt'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('engylt'),
  },
  {
    code: code('DBY'),
    name: 'Darby Translation',
    shortName: 'Darby',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('engDBY'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('engDBY'),
  },
  {
    code: code('WBT'),
    name: 'Noah Webster Bible',
    shortName: 'Webster Bible',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('engwebster'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('engwebster'),
  },
  {
    code: code('GNV'),
    name: 'Geneva Bible 1599',
    shortName: 'Geneva Bible',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('enggnv'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('enggnv'),
  },
  {
    code: code('BBE'),
    name: 'Bible in Basic English',
    shortName: 'Basic English',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('engBBE'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('engBBE'),
  },
  {
    code: code('DRA'),
    name: 'Douay-Rheims American Edition 1899',
    shortName: 'Douay-Rheims',
    language: 'en',
    status: 'available',
    textSourceUrl: ebibleUsfm('engDRA'),
    formats: [...EBIBLE_FORMATS],
    licence: ebiblePublicDomain('engDRA'),
  },
  {
    code: code('LSV'),
    name: 'Literal Standard Version',
    shortName: 'Literal Standard Version',
    language: 'en',
    status: 'pending-implementation',
    textSourceUrl: 'https://ebible.org/find/details.php?id=englsv',
    formats: ['USFM', 'USFX', 'TXT', 'SQL'],
    blockedReason:
      'Commercial use requires full attribution naming both the version and the ' +
      'publisher. Available once attribution rendering is implemented.',
    licence: {
      name: 'CC BY-SA 4.0',
      sourceUrl: 'https://www.lsvbible.com/p/get-lsv.html',
      rightsHolder: 'Covenant Press, Covenant Christian Coalition',
      commercialUse: 'permitted',
      redistribution: 'full',
      limits: { completeBookPermitted: true },
      attribution: {
        required: true,
        // Required wording for commercial use or whole-book distribution.
        // Scrinode is both.
        text: 'Literal Standard Version (LSV), Covenant Press, Covenant Christian Coalition',
        inlineMarker: 'LSV',
      },
      aiUse: 'not-stated',
      shareAlike: true,
      notes: [
        'A 1,000-verse commercial cap is widely repeated by third parties but does NOT appear on the publisher’s current permissions page. Not encoded here. Confirm with Covenant Press before relying on either reading.',
        'Share-alike binds derivative works. Serving unmodified text is distribution, not adaptation.',
        'Publisher names CC BY-SA without a version in body text; 4.0 comes from the eBible.org copy.',
      ],
    },
  },
  {
    code: code('FBV'),
    name: 'Free Bible Version',
    shortName: 'Free Bible Version',
    language: 'en',
    status: 'blocked',
    textSourceUrl: 'https://ebible.org/find/details.php?id=engfbv',
    formats: ['USFM', 'USFX', 'TXT', 'SQL'],
    blockedReason:
      'Old Testament coverage is unverified; the translation is principally a New ' +
      'Testament. Confirm scope before offering it as a whole-Bible option.',
    licence: {
      name: 'CC BY-SA 4.0',
      sourceUrl: 'https://www.freebibleversion.org/',
      rightsHolder: 'Dr. Jonathan Gallagher',
      commercialUse: 'permitted',
      redistribution: 'full',
      limits: { completeBookPermitted: true },
      attribution: {
        required: true,
        // No publisher-specified wording; these are the CC BY-SA 4.0 defaults.
        text: 'Copyright © 2018 Dr. Jonathan Gallagher, licensed under CC BY-SA 4.0',
        inlineMarker: 'FBV',
        linkUrl: 'https://creativecommons.org/licenses/by-sa/4.0/legalcode',
      },
      aiUse: 'not-stated',
      shareAlike: true,
      notes: [
        'Publisher specifies no custom attribution string; CC BY-SA 4.0 defaults apply.',
      ],
    },
  },
  {
    code: code('NET'),
    name: 'The NET Bible (New English Translation)',
    shortName: 'NET Bible',
    language: 'en',
    status: 'requires-agreement',
    blockedReason:
      'Despite its reputation, the NET is NOT an open licence. The free grant is ' +
      'non-commercial only and permits redistribution solely where the text is ' +
      'given away with no monetisation of any kind — no paid tier, no ads, no ' +
      'donation solicitation. Commercial use requires an agreement with ' +
      'HarperCollins Christian Publishing.',
    licence: {
      name: 'Proprietary (custom non-commercial grant)',
      sourceUrl: 'https://netbible.com/copyright/',
      rightsHolder: 'Biblical Studies Press, L.L.C.',
      commercialUse: 'prohibited',
      redistribution: 'full-non-commercial',
      limits: { completeBookPermitted: true },
      attribution: {
        required: true,
        text:
          'Scripture quoted by permission. Quotations designated (NET) are from the ' +
          'NET Bible® copyright ©1996, 2019 by Biblical Studies Press, ' +
          'L.L.C. http://netbible.com All rights reserved',
        inlineMarker: '(NET)',
        // The licence specifically requires the marker to be hyperlinked in
        // internet-connected applications.
        linkUrl: 'http://netbible.org',
      },
      aiUse: 'not-stated',
      shareAlike: false,
      notes: [
        'Licence reserves all permissions not expressly granted, so AI and RAG use should be treated as ungranted absent written permission.',
        'NET translator notes are excluded even from the non-commercial grant.',
        'No bulk USFM/OSIS/JSON download is offered under the free grant.',
        'A "complete book" cap is repeated by third parties but does not appear on the publisher’s current page.',
      ],
    },
  },
];

const BY_CODE = new Map<string, TranslationMeta>(
  TRANSLATIONS.map((t) => [t.code.toUpperCase(), t]),
);

/** Look up a translation by code, case-insensitively. */
export function getTranslation(value: string): TranslationMeta | undefined {
  return BY_CODE.get(value.trim().toUpperCase());
}

/** Whether a code names a translation Scrinode knows about, shippable or not. */
export function isKnownTranslation(value: string): boolean {
  return BY_CODE.has(value.trim().toUpperCase());
}

/**
 * Whether Scrinode may serve this translation's text right now.
 *
 * This is the gate. Registry membership is not permission, and neither is a
 * permissive licence with an unimplemented obligation.
 */
export function isAvailable(value: string): boolean {
  return getTranslation(value)?.status === 'available';
}

/** Translations that may be offered in the selector today. */
export function availableTranslations(): readonly TranslationMeta[] {
  return TRANSLATIONS.filter((t) => t.status === 'available');
}

/**
 * Attribution that must be rendered wherever this translation's text appears.
 *
 * Returns `undefined` only when the licence requires none. Callers displaying
 * text must render this when it is present.
 */
export function requiredAttribution(value: string): string | undefined {
  const translation = getTranslation(value);
  if (!translation?.licence.attribution.required) return undefined;
  return translation.licence.attribution.text;
}
