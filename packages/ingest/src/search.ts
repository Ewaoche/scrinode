import type { Pool } from 'pg';
import {
  EMBEDDING_MODEL,
  HNSW_EF_SEARCH,
  RETRIEVAL_TABLE,
  distanceToScore,
  toVectorLiteral,
  type RetrievalUnit,
} from './retrieval.js';
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
  /**
   * Restrict to one granularity.
   *
   * Usually leave this unset. Granularities compete on score, and the right
   * one wins: "the shepherd psalm" surfaces Psalm 23 as a chapter unit,
   * while "how should I pray" surfaces Matthew 6 passages. Filtering to
   * `passage` hides every chapter shorter than one window — Psalm 23 is six
   * verses and therefore has no passage unit at all.
   */
  readonly unitType?: RetrievalUnit['unitType'];
  readonly bookId?: string;
  readonly testament?: 'OT' | 'NT';
  readonly canon?: 'protestant' | 'deuterocanonical';
  readonly limit?: number;
  /**
   * How many graph nodes HNSW visits before ranking.
   *
   * Higher means better recall and more work. Below the requested row count
   * the index cannot return a full result set; well above it, latency grows
   * for diminishing recall.
   */
  readonly efSearch?: number;
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
  /** Cosine similarity in 0..1, converted from pgvector's distance. */
  readonly score: number;
}

/** A row as Postgres returns it, before mapping to a hit. */
interface HitRow {
  id: string;
  unit_type: RetrievalUnit['unitType'];
  translation: string | null;
  reference_start: string | null;
  reference_end: string | null;
  text: string;
  verse_ids: string[] | null;
  distance: number | string;
}

/**
 * Build the WHERE clause and its parameters.
 *
 * Values are always bound as parameters, never interpolated — a filter
 * reaching this function may have come from a user (§33). The parameter
 * numbering starts after the query vector, which is always `$1`.
 */
function buildFilter(options: SearchOptions): {
  clause: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const add = (column: string, value: string) => {
    params.push(value);
    // +1 because $1 is the query vector.
    conditions.push(`${column} = $${params.length + 1}`);
  };

  if (options.translation) add('translation', options.translation.toUpperCase());
  if (options.unitType) add('unit_type', options.unitType);
  if (options.bookId) add('book_id', options.bookId.toUpperCase());
  if (options.testament) add('testament', options.testament);
  if (options.canon) add('canon', options.canon);

  // Never mix vectors from different models: their spaces are unrelated, so
  // scores would be meaningless across them.
  add('embedding_model', EMBEDDING_MODEL);

  // Unembedded rows would otherwise sort last by distance rather than being
  // excluded, filling a short result set with rows that cannot match.
  conditions.push('embedding IS NOT NULL');

  return { clause: `WHERE ${conditions.join(' AND ')}`, params };
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
  pool: Pool,
  question: string,
  options: SearchOptions,
): Promise<SearchHit[]> {
  const limit = options.limit ?? 5;
  const efSearch = Math.max(options.efSearch ?? HNSW_EF_SEARCH, limit);

  const { embeddings } = await embedBatch([question], 'query', {
    apiKey: options.apiKey,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  const queryVector = embeddings[0];

  if (!queryVector) return [];

  const { clause, params } = buildFilter(options);

  // A dedicated connection, because `SET LOCAL` applies to a transaction and
  // pooled queries may otherwise land on different connections — leaving
  // ef_search unset for the query that needs it.
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL hnsw.ef_search = ${efSearch}`);

    const { rows } = await client.query<HitRow>(
      `SELECT id,
              unit_type,
              translation,
              reference_start,
              reference_end,
              text,
              verse_ids,
              embedding <=> $1::halfvec AS distance
         FROM ${RETRIEVAL_TABLE}
         ${clause}
        ORDER BY embedding <=> $1::halfvec
        LIMIT ${limit}`,
      [toVectorLiteral(queryVector), ...params],
    );

    await client.query('COMMIT');

    return rows.map(toHit);
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
}

/**
 * Map a row to a hit.
 *
 * `distance` may arrive as a string: `pg` returns some numeric types as text
 * to avoid precision loss, and a string would silently sort and compare
 * wrongly.
 */
function toHit(row: HitRow): SearchHit {
  return {
    _id: row.id,
    unitType: row.unit_type,
    ...(row.translation ? { translation: row.translation } : {}),
    ...(row.reference_start ? { referenceStart: row.reference_start } : {}),
    ...(row.reference_end ? { referenceEnd: row.reference_end } : {}),
    text: row.text,
    ...(row.verse_ids ? { verseIds: row.verse_ids } : {}),
    score: distanceToScore(Number(row.distance)),
  };
}

/**
 * Score below which a hit is probably noise.
 *
 * Vector search always returns its top-k, so an unrelated question still
 * gets results. Measured against this corpus, relevant hits score 0.74-0.85
 * and deliberately irrelevant ones ("recipe for chocolate cake", "how to
 * configure a firewall") score 0.62-0.64.
 *
 * These were measured on Atlas, and they carry over unchanged: both use
 * cosine over the same vectors, and `distanceToScore` converts pgvector's
 * distance back into the similarity Atlas reported.
 *
 * This is a guide for callers, not applied here: the right floor depends on
 * what the caller does with a miss, and Zedek answering "I have nothing
 * relevant" is better than Zedek grounding on a 0.62 match.
 */
export const LIKELY_RELEVANT_SCORE = 0.68;

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
