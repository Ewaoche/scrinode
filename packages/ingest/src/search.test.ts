import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { formatRange, searchUnits } from './search.js';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, HNSW_EF_SEARCH } from './retrieval.js';

/**
 * A stub pool capturing the SQL and its parameters, so the query shape can be
 * asserted without a database. The query is what determines whether results
 * are correct, and it is easy to get subtly wrong.
 */
function stubPool(results: unknown[] = []) {
  const captured: { sql: string[]; params: unknown[][] } = { sql: [], params: [] };

  const client = {
    query: (sql: string, params?: unknown[]) => {
      captured.sql.push(sql);
      if (params) captured.params.push(params);

      // BEGIN, COMMIT and SET carry no rows; only the search returns any.
      return Promise.resolve({ rows: sql.includes('SELECT') ? results : [] });
    },
    release: () => undefined,
  };

  return {
    captured,
    /** The statement that performs the search, rather than BEGIN or SET. */
    searchSql: () => captured.sql.find((s) => s.includes('SELECT')) ?? '',
    pool: { connect: () => Promise.resolve(client) } as unknown as Pool,
  };
}

/** A fetch returning one well-formed query embedding. */
const embedOnce = () =>
  vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1),
              index: 0,
            },
          ],
          usage: { total_tokens: 5 },
        }),
        { status: 200 },
      ),
  );

describe('searchUnits', () => {
  it('orders by cosine distance, which is what the index is built for', async () => {
    // An index built for cosine cannot serve a query using another operator;
    // Postgres would silently fall back to a sequential scan.
    const { pool, searchSql } = stubPool();

    await searchUnits(pool, 'a question', {
      apiKey: 'k',
      fetchImpl: embedOnce() as never,
    });

    expect(searchSql()).toContain('ORDER BY embedding <=> $1::halfvec');
  });

  it('always filters to the current model', async () => {
    // Vectors from different models occupy unrelated spaces; mixing them
    // would produce scores that mean nothing.
    const { pool, captured, searchSql } = stubPool();

    await searchUnits(pool, 'q', { apiKey: 'k', fetchImpl: embedOnce() as never });

    expect(searchSql()).toContain('embedding_model = $');
    expect(captured.params.flat()).toContain(EMBEDDING_MODEL);
  });

  it('excludes rows with no vector', async () => {
    // They would otherwise sort last rather than being excluded, filling a
    // short result set with rows that cannot match.
    const { pool, searchSql } = stubPool();

    await searchUnits(pool, 'q', { apiKey: 'k', fetchImpl: embedOnce() as never });

    expect(searchSql()).toContain('embedding IS NOT NULL');
  });

  it('binds filters as parameters rather than interpolating them', async () => {
    // A filter may have come from a user. Interpolation here would be an
    // injection hole no upstream validation could close.
    const { pool, captured, searchSql } = stubPool();

    await searchUnits(pool, 'q', {
      apiKey: 'k',
      translation: 'bsb',
      unitType: 'passage',
      bookId: 'rom',
      fetchImpl: embedOnce() as never,
    });

    const params = captured.params.flat();

    // Upper-cased to match how rows store them.
    expect(params).toContain('BSB');
    expect(params).toContain('ROM');
    expect(params).toContain('passage');

    expect(searchSql()).not.toContain('BSB');
  });

  it('raises ef_search above the pgvector default for recall', async () => {
    // The default of 40 measurably drops relevant hits at this corpus size,
    // and a search that misses the passage is not worth running.
    const { pool, captured } = stubPool();

    await searchUnits(pool, 'q', { apiKey: 'k', fetchImpl: embedOnce() as never });

    expect(captured.sql.some((s) => s.includes(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`))).toBe(
      true,
    );
  });

  it('never sets ef_search below the number of rows requested', async () => {
    // The index cannot return more rows than it visits.
    const { pool, captured } = stubPool();

    await searchUnits(pool, 'q', {
      apiKey: 'k',
      limit: 500,
      efSearch: 10,
      fetchImpl: embedOnce() as never,
    });

    expect(captured.sql.some((s) => s.includes('SET LOCAL hnsw.ef_search = 500'))).toBe(true);
  });

  it('runs in a transaction, because SET LOCAL needs one', async () => {
    // Outside a transaction SET LOCAL does nothing, and pooled queries could
    // land on a different connection than the one it was set on.
    const { pool, captured } = stubPool();

    await searchUnits(pool, 'q', { apiKey: 'k', fetchImpl: embedOnce() as never });

    expect(captured.sql[0]).toBe('BEGIN');
    expect(captured.sql).toContain('COMMIT');
  });

  it('converts distance into the similarity score callers expect', async () => {
    // pgvector returns distance, Atlas returned similarity, and every
    // measured threshold is in similarity.
    const { pool } = stubPool([
      {
        id: 'u1',
        unit_type: 'passage',
        translation: 'BSB',
        reference_start: 'ROM.8.28',
        reference_end: 'ROM.8.30',
        text: 'And we know...',
        verse_ids: ['BSB:ROM.8.28'],
        distance: 0.2,
      },
    ]);

    const [hit] = await searchUnits(pool, 'q', {
      apiKey: 'k',
      fetchImpl: embedOnce() as never,
    });

    expect(hit?.score).toBeCloseTo(0.8);
  });

  it('parses a distance returned as a string', async () => {
    // `pg` returns some numeric types as text to avoid precision loss, and a
    // string would sort and compare wrongly.
    const { pool } = stubPool([
      {
        id: 'u1',
        unit_type: 'verse',
        translation: 'BSB',
        reference_start: 'ROM.8.28',
        reference_end: 'ROM.8.28',
        text: 'text',
        verse_ids: null,
        distance: '0.25',
      },
    ]);

    const [hit] = await searchUnits(pool, 'q', {
      apiKey: 'k',
      fetchImpl: embedOnce() as never,
    });

    expect(hit?.score).toBeCloseTo(0.75);
    expect(typeof hit?.score).toBe('number');
  });

  it('embeds the question as a query, not a document', async () => {
    // Voyage prepends a different instruction for each. Mismatching them is
    // the easiest retrieval bug to introduce and the hardest to notice.
    const fetchImpl = embedOnce();
    const { pool } = stubPool();

    await searchUnits(pool, 'q', { apiKey: 'k', fetchImpl: fetchImpl as never });

    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.input_type).toBe('query');
  });
});

describe('formatRange', () => {
  it('collapses a single-verse range', () => {
    expect(formatRange({ referenceStart: 'ROM.8.28', referenceEnd: 'ROM.8.28' })).toBe(
      'ROM.8.28',
    );
  });

  it('abbreviates a range within one chapter', () => {
    expect(formatRange({ referenceStart: 'ROM.8.1', referenceEnd: 'ROM.8.6' })).toBe('ROM.8.1-6');
  });

  it('spells out a range crossing chapters', () => {
    expect(formatRange({ referenceStart: 'ROM.8.39', referenceEnd: 'ROM.9.2' })).toBe(
      'ROM.8.39-ROM.9.2',
    );
  });

  it('handles a missing end', () => {
    expect(formatRange({ referenceStart: 'ROM.8.28' })).toBe('ROM.8.28');
  });

  it('returns empty when there is no reference', () => {
    expect(formatRange({})).toBe('');
  });
});
