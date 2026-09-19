/**
 * Source provenance — AGENTS.md §21.
 *
 * Every imported source must record licensing and origin. Never ingest
 * external biblical or scholarly data without it.
 */
export interface SourceProvenance {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceType: string;
  readonly license?: string;
  readonly attribution?: string;
  readonly sourceUrl?: string;
  readonly importedAt: Date;
}

/**
 * A citation attached to generated or retrieved material.
 *
 * AGENTS.md §2: Scripture, interpretation, AI synthesis and user content must
 * remain visibly distinct. `kind` is what preserves that distinction when
 * material is copied, saved or exported.
 */
export interface Citation {
  readonly kind: 'scripture' | 'research-source' | 'lexical' | 'historical';
  readonly label: string;
  readonly sourceId?: string;
  readonly canonicalReference?: string;
}
