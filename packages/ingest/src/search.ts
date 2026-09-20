import type { Collection } from 'mongodb';
import { EMBEDDING_MODEL, VECTOR_INDEX_NAME, type RetrievalUnit } from './retrieval.js';
import { embedBatch } from './voyage.js';

/**
 * Vector search over retrieval units.
 *
 * This is the read side of §20's hybrid retrieval: the vector half. Zedek
 * will combine it with reference parsing, structured lookup and cross
 * references rather than using it alone — §19 is explicit that RAG must not
 * be "question → vector search → chunks → model".
 *
 * Kept here rather than in the API so the ingestion CLI can exercise it
 * directly. A retrieval change that cannot be tested without booting the API
 * will not get tested.
 */

export interface SearchOptions {
  readonly apiKey: string;
  /** Restrict to one translation. Without it, results repeat across them. */
  readonly translation?: string;
  /** Restrict to one granularity, e.g. only passages. */
  readonly unitType?: RetrievalUnit['unitType'];
  readonly bookId?: string;
  readonly testament?: 'OT' | 'NT';
  readonly canon?: 'protestant' | 'deuterocanonical';
  readonly limit?: number;
  /**
   * How many candidates Atlas considers before ranking.
   *
   * Higher means better recall and more work. MongoDB suggests roughly ten
   * to twenty times the limit; below that, relevant hits are missed before
   * scoring ever happens.
   */
  readonly numCandidates?: number;
  /** Injected in tests so the query shape can be asserted without network. */
  readonly fetchImpl?: typeof fetch;
}

export interface SearchHit {
  readonly _id: string;
  readonly unitType: RetrievalUnit['unitType'];
  readonly translation?: string;
  readonly referenceStart?: string;
  readonly referenceEnd?: string;
  readonly text: string;
  readonly verseIds?: readonly string[];
  /** Atlas relevance score. Cosine similarity mapped into 0..1. */
  readonly score: number;
}

/**
 * Build the `$vectorSearch` filter.
 *
 * Only fields declared as filters on the index may appear here; anything
 * else is rejected at query time rather than ignored.
 */
function buildFilter(options: SearchOptions): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (options.translation) filter['translation'] = options.translation.toUpperCase();
  if (options.unitType) filter['unitType'] = options.unitType;
  if (options.bookId) filter['bookId'] = options.bookId.toUpperCase();
  if (options.testament) filter['testament'] = options.testament;
  if (options.canon) filter['canon'] = options.canon;

  // Never mix vectors from different models: their spaces are unrelated, so
  // scores would be meaningless across them.
  filter['embeddingModel'] = EMBEDDING_MODEL;

  return filter;
}

/**
 * Search retrieval units by meaning.
 *
 * The query is embedded with `input_type: 'query'` while stored text used
 * `'document'`. Voyage prepends a different instruction for each, and
 * mismatching them measurably degrades results — this is the single easiest
 * retrieval bug to introduce and the hardest to notice.
 */
export async function searchUnits(
  collection: Collection<RetrievalUnit>,
  question: string,
  options: SearchOptions,
): Promise<SearchHit[]> {
  const limit = options.limit ?? 5;
  const numCandidates = options.numCandidates ?? Math.max(100, limit * 20);

  const { embeddings } = await embedBatch([question], 'query', {
    apiKey: options.apiKey,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  const queryVector = embeddings[0];

  if (!queryVector) return [];

  const hits = await collection
    .aggregate<SearchHit>([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector,
          numCandidates,
          limit,
          filter: buildFilter(options),
        },
      },
      {
        $project: {
          unitType: 1,
          translation: 1,
          referenceStart: 1,
          referenceEnd: 1,
          text: 1,
          verseIds: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ])
    .toArray();

  return hits;
}

/** Render a reference range for display, collapsing a single-verse range. */
export function formatRange(hit: Pick<SearchHit, 'referenceStart' | 'referenceEnd'>): string {
  const { referenceStart, referenceEnd } = hit;
  if (!referenceStart) return '';
  if (!referenceEnd || referenceEnd === referenceStart) return referenceStart;

  // Same book and chapter, so only the closing verse need be shown.
  const startParts = referenceStart.split('.');
  const endParts = referenceEnd.split('.');

  if (startParts[0] === endParts[0] && startParts[1] === endParts[1]) {
    return `${referenceStart}-${endParts[2]}`;
  }

  return `${referenceStart}-${referenceEnd}`;
}
