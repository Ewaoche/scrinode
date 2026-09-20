/**
 * Translation licence terms — AGENTS.md §21, §22.
 *
 * `SourceProvenance.license` is a free-text string and stays that way: for a
 * scholarly dataset the licence is documentation. For a Bible translation it
 * is operational. A verse cap either gets enforced or it does not, and a
 * required attribution either renders or the licence is breached. Those need
 * fields, not prose.
 *
 * AGENTS.md §42 forbids inventing licensing terms. Every field here can be
 * `'not-stated'`, and that is a real answer meaning the publisher is silent —
 * distinct from a permission granted or denied. Code must never read
 * `'not-stated'` as permission. See `docs/TRANSLATION_LICENSING.md` for the
 * sourced terms behind each registry entry.
 */

/**
 * A permission the publisher may grant, refuse, or never address.
 *
 * The third case is the common one and the dangerous one: most Bible
 * publishers wrote their terms before retrieval-augmented generation existed
 * and say nothing about it. Collapsing that silence into a boolean would
 * turn "nobody knows" into "yes".
 */
export type LicencePermission = 'permitted' | 'prohibited' | 'not-stated';

/** How far a licence lets Scrinode go with the text as a whole. */
export type RedistributionRight =
  /** The full text may be stored and served, including commercially. */
  | 'full'
  /** The full text may be stored and served only with no monetisation of any kind. */
  | 'full-non-commercial'
  /** Only excerpts within the stated limits may be shown. */
  | 'excerpt-only'
  /** No grant obtained yet. */
  | 'none';

/**
 * Quantitative display limits.
 *
 * Absent fields mean the publisher states no limit. That is different from a
 * limit we failed to look up: an entry whose terms are unverified must be
 * `status: 'blocked'` in the registry rather than carrying empty limits here.
 */
export interface LicenceLimits {
  /** Maximum contiguous verses that may be displayed in one response. */
  readonly maxContiguousVerses?: number;
  /** Maximum verses across a single work or product. */
  readonly maxTotalVerses?: number;
  /** Maximum share of the whole Bible, as a percentage. */
  readonly maxPercentOfWork?: number;
  /** Whether a complete book of the Bible may be displayed as a unit. */
  readonly completeBookPermitted: boolean;
}

/**
 * Attribution the licence obliges Scrinode to display.
 *
 * `text` is stored verbatim from the publisher. Publishers that specify exact
 * wording mean it, and paraphrasing a required notice breaches the licence.
 */
export interface AttributionRequirement {
  readonly required: boolean;
  /** Verbatim notice, exactly as the publisher words it. */
  readonly text?: string;
  /** Short marker shown beside a quotation, e.g. `(NET)`. */
  readonly inlineMarker?: string;
  /** URL the marker or notice must link to, where the licence demands one. */
  readonly linkUrl?: string;
}

/** The complete operational terms for one text. */
export interface LicenceTerms {
  /** Licence name as the publisher states it, e.g. `CC BY-SA 4.0`. */
  readonly name: string;
  /** The publisher's own licence page. Not a third-party summary. */
  readonly sourceUrl: string;
  /** Rights holder, or `'public domain'` where there is none. */
  readonly rightsHolder: string;
  readonly commercialUse: LicencePermission;
  readonly redistribution: RedistributionRight;
  readonly limits: LicenceLimits;
  readonly attribution: AttributionRequirement;
  /**
   * Whether the licence addresses AI training or retrieval-augmented
   * generation. Almost universally `'not-stated'`.
   *
   * Scrinode grounds Zedek in retrieved Scripture (AGENTS.md §20), so this
   * matters more here than it would for a plain reader.
   */
  readonly aiUse: LicencePermission;
  /**
   * Whether derivative works must carry the same licence. Serving unmodified
   * text is distribution rather than adaptation, but anything that adapts the
   * text inherits the obligation.
   */
  readonly shareAlike: boolean;
  /**
   * Trademark or naming conditions that survive a public-domain dedication.
   * Public domain removes copyright; it does not remove a trademark.
   */
  readonly namingConstraint?: string;
  /** Anything a reviewer must know that the fields above cannot express. */
  readonly notes?: readonly string[];
}
