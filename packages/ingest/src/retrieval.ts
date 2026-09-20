import type { Binary } from 'mongodb';
import type { BookId, Canon, Testament, TranslationCode } from '@scrinode/types';

/**
 * Retrieval units — what Zedek searches over.
 *
 * AGENTS.md §20 opens with "Do not embed isolated verses only", and this is
 * why the `verses` collection is not itself embedded. A verse in isolation
 * often cannot be understood: "But he said unto them, It is I; be not afraid"
 * carries almost no retrievable meaning without the surrounding narrative.
 *
 * So retrieval units are a separate collection with their own shape, their
 * own provenance and their own lifecycle. A unit may span verses, and the
 * same verse appears in several units at different granularities.
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
 * the vector index can narrow on. §20 says "design for filtered vector
 * search", and filters are what make the difference between a usable result
 * and ten copies of the same verse in ten translations.
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
   * The vector, stored as a BSON `BinData` float32 array rather than an
   * array of numbers.
   *
   * BSON has no float type: an array of numbers becomes 1024 doubles, which
   * measured at 14.2 KB per unit and filled a 512 MB cluster at 60% of one
   * translation. The same vector as `BinData` subtype 9 is 4 KB — a bit over
   * a third the size — and Atlas indexes both identically, so the index
   * definition does not change.
   *
   * Absent until embedded, which is how the embedder finds work to do.
   */
  readonly embedding?: Binary;
  readonly embeddingModel?: string;
  readonly embeddedAt?: Date;
  /** SHA256 of `text`, so an edit is detectable without comparing vectors. */
  readonly textHash?: string;
}

export const RETRIEVAL_COLLECTION = 'retrieval_units';

/**
 * The embedding model.
 *
 * voyage-4 is Voyage's current general-purpose model; their docs call the
 * previous generation strictly worse "in all aspects". It defaults to 1024
 * dimensions, which is the number the Atlas index declares — changing it
 * later means dropping the index and re-embedding every document.
 *
 * voyage-4 also supports 256, 512 and 2048 if the index ever needs to shrink,
 * which voyage-3 did not.
 *
 * Recorded on each document as `embeddingModel` so a future migration can
 * find and re-embed only what an older model produced.
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
 * The Atlas Vector Search index definition.
 *
 * Generated rather than written by hand so the dimensions can never drift
 * from `EMBEDDING_DIMENSIONS`, and so the filter list is reviewable as code.
 *
 * Filters are declared up front because Atlas requires it: adding one later
 * means rebuilding the index. Each one here answers a question the reader or
 * Zedek will actually ask.
 */
export function vectorIndexDefinition(): object {
  return {
    fields: [
      {
        type: 'vector',
        path: 'embedding',
        numDimensions: EMBEDDING_DIMENSIONS,
        // Cosine: Voyage embeddings are normalised, and cosine is what the
        // model was trained against.
        similarity: 'cosine',
        // Scalar quantization cuts index memory roughly fourfold with
        // negligible recall loss at this scale. Without it, ~200k units at
        // 1024 float32 dimensions is around 800MB resident.
        quantization: 'scalar',
      },
      // Without this, a search returns the same verse once per translation.
      { type: 'filter', path: 'translation' },
      // Lets Zedek retrieve passages without competing verse-level hits.
      { type: 'filter', path: 'unitType' },
      // Scoping a question to a book, or to one testament.
      { type: 'filter', path: 'bookId' },
      { type: 'filter', path: 'testament' },
      // Deuterocanonical results must be suppressible for readers whose
      // tradition excludes them.
      { type: 'filter', path: 'canon' },
      // Re-embedding after a model change, without touching current vectors.
      { type: 'filter', path: 'embeddingModel' },
    ],
  };
}

export const VECTOR_INDEX_NAME = 'retrieval_vector_index';
