import type { BookId, Canon, Testament, TranslationCode } from '@scrinode/types';

/**
 * Retrieval units — what Zedek searches over.
 *
 * AGENTS.md §20 opens with "Do not embed isolated verses only", and this is
 * why the `verses` collection is not itself embedded. A verse in isolation
 * often cannot be understood: "But he said unto them, It is I; be not afraid"
 * carries almost no retrievable meaning without the surrounding narrative.
 *
 * So retrieval units are a separate table with their own shape, their own
 * provenance and their own lifecycle. A unit may span verses, and the same
 * verse appears in several units at different granularities.
 *
 * §20 lists nine unit types. Three are derivable from the text Scrinode has
 * ingested. The rest need source data that does not exist yet — inventing
 * pericope boundaries or topical assignments would be fabricating Bible data,
 * which directive 2 and §42 forbid and §21's provenance requirement rules
 * out. They are declared here so the schema and index do not change when
 * their sources arrive.
 */

export type RetrievalUnitType =
  /** One verse. Precise lookup for the Verse Inspector. */
  | 'verse'
  /** A window of consecutive verses within one chapter. */
  | 'passage'
  /** A whole chapter. */
  | 'chapter'
  /** An editorial section. Needs section boundary data — not yet sourced. */
  | 'pericope'
  /** A theme. Needs a topical index — not yet sourced. */
  | 'topic'
  /** A person, place or thing. Needs a named-entity dataset — not yet sourced. */
  | 'entity'
  /** A Greek or Hebrew lexeme. Needs a lexicon — not yet sourced. */
  | 'lexical'
  /** Historical or cultural background. Needs a corpus — not yet sourced. */
  | 'historical'
  /** Secondary literature. Needs a corpus — not yet sourced. */
  | 'research';

/** Unit types that can be built from ingested Scripture alone. */
export const DERIVABLE_UNIT_TYPES: readonly RetrievalUnitType[] = [
  'verse',
  'passage',
  'chapter',
];

/**
 * Unit types awaiting source data.
 *
 * Listed explicitly so the gap is visible rather than implied by absence,
 * and so a future ingestion can assert it is filling a known hole.
 */
export const PENDING_UNIT_TYPES: readonly RetrievalUnitType[] = [
  'pericope',
  'topic',
  'entity',
  'lexical',
  'historical',
  'research',
];

/**
 * A unit of text that can be retrieved and embedded.
 *
 * Every field outside `embedding` is either identity, provenance, or a filter
 * a query can narrow on. §20 says "design for filtered vector search", and
 * filters are what make the difference between a usable result and ten
 * copies of the same verse in ten translations.
 *
 * Field names are camelCase here and snake_case in the database; the
 * repository maps between them. See `UNIT_COLUMNS`.
 */
export interface RetrievalUnit {
  readonly _id: string;
  readonly unitType: RetrievalUnitType;

  /** Absent for units not tied to one translation, e.g. a lexical entry. */
  readonly translation?: TranslationCode;
  readonly bookId?: BookId;
  readonly canon?: Canon;
  readonly testament?: Testament;

  /** Canonical reference bounds, e.g. `PHP.4.10` to `PHP.4.20`. */
  readonly referenceStart?: string;
  readonly referenceEnd?: string;
  readonly chapter?: number;

  /** The text that gets embedded and shown as a retrieval result. */
  readonly text: string;
  /** Verses covered, so a hit can be expanded to its source verses. */
  readonly verseIds?: readonly string[];
  readonly language: string;

  /** Sortable start position, matching the verses collection's ordinal. */
  readonly ordinal?: number;

  // --- provenance (§21) ----------------------------------------------------
  readonly sourceId: string;
  readonly release?: string;

  // --- embedding -----------------------------------------------------------
  /**
   * The vector.
   *
   * Held in memory as a plain number array and stored as pgvector's
   * `halfvec(1024)` — 16-bit floats. At 1024 dimensions the recall
   * difference against float32 is negligible, while storage and index memory
   * halve: ~86 MB rather than ~172 MB across all 34 sources.
   *
   * Absent until embedded, which is how the embedder finds work to do.
   */
  readonly embedding?: readonly number[];
  readonly embeddingModel?: string;
  readonly embeddedAt?: Date;
  /** SHA256 of `text`, so an edit is detectable without comparing vectors. */
  readonly textHash?: string;
}

export const RETRIEVAL_TABLE = 'retrieval_units';

/**
 * The embedding model.
 *
 * voyage-4 is Voyage's current general-purpose model; their docs call the
 * previous generation strictly worse "in all aspects". It defaults to 1024
 * dimensions, which is the width the `halfvec` column declares — changing it
 * later means altering the column and re-embedding every row.
 *
 * voyage-4 also supports 256, 512 and 2048 if the index ever needs to shrink,
 * which voyage-3 did not.
 *
 * Recorded on each row as `embedding_model` so a future migration can find
 * and re-embed only what an older model produced.
 */
export const EMBEDDING_MODEL = 'voyage-4';
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Passage window size, in verses.
 *
 * Large enough to carry an argument across a few verses, small enough that a
 * hit points somewhere specific. Windows overlap by half so a passage
 * straddling a boundary is still retrievable whole.
 */
export const PASSAGE_WINDOW = 6;
export const PASSAGE_STRIDE = 3;

/**
 * Column names for `RetrievalUnit` fields.
 *
 * The interface is camelCase because it is TypeScript; the table is
 * snake_case because it is Postgres, whose unquoted identifiers fold to
 * lower case. Declared once here so the mapping cannot drift between the
 * writer and the reader (AGENTS.md §42).
 */
export const UNIT_COLUMNS = {
  _id: 'id',
  unitType: 'unit_type',
  translation: 'translation',
  bookId: 'book_id',
  canon: 'canon',
  testament: 'testament',
  chapter: 'chapter',
  referenceStart: 'reference_start',
  referenceEnd: 'reference_end',
  text: 'text',
  verseIds: 'verse_ids',
  language: 'language',
  ordinal: 'ordinal',
  sourceId: 'source_id',
  release: 'release',
  embedding: 'embedding',
  embeddingModel: 'embedding_model',
  embeddedAt: 'embedded_at',
  textHash: 'text_hash',
} as const satisfies Record<keyof RetrievalUnit, string>;

/** Name of the HNSW index over `embedding`. */
export const VECTOR_INDEX_NAME = 'retrieval_units_embedding_idx';

/**
 * How many graph nodes HNSW visits per query.
 *
 * pgvector's default of 40 is tuned for speed over recall, and at this corpus
 * size it measurably drops relevant hits — the search is not worth running
 * if it misses the passage the reader wanted. Raising it trades latency for
 * recall; it must be at least the number of rows requested.
 *
 * Set per session with `SET LOCAL hnsw.ef_search`, never globally: a bulk
 * job and an interactive query want different values.
 */
export const HNSW_EF_SEARCH = 100;

/**
 * Serialise a vector into pgvector's text input format.
 *
 * pgvector accepts `[0.1,0.2,...]` and the driver sends it as text. Built
 * here rather than at each call site so the format, and the dimension check
 * that guards it, exist once.
 *
 * A wrong-width vector is rejected by Postgres at insert time with an error
 * naming the column rather than the cause, so checking here names the real
 * problem.
 */
export function toVectorLiteral(embedding: readonly number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, received ${embedding.length}. ` +
        'The embedding model and the halfvec column width must agree.',
    );
  }

  return `[${embedding.join(',')}]`;
}

/**
 * Convert pgvector's cosine distance into a similarity score.
 *
 * The `<=>` operator returns cosine *distance*, where 0 is identical. Atlas
 * returned similarity, where 1 is identical. Converting at this boundary
 * keeps every measured threshold — `LIKELY_RELEVANT_SCORE` above all —
 * meaning what it did before the migration.
 *
 * Getting this backwards does not fail: it silently ranks the least relevant
 * result first, which is why the conversion lives in one named function
 * rather than inline at each call site.
 */
export function distanceToScore(distance: number): number {
  return 1 - distance;
}
