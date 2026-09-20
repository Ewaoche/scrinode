import { describe, expect, it, vi } from 'vitest';
import { formatRange, searchUnits } from './search.js';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, VECTOR_INDEX_NAME } from './retrieval.js';

/**
 * A stub collection capturing the aggregation pipeline, so the query shape
 * can be asserted without a database. The pipeline is what determines
 * whether results are correct, and it is easy to get subtly wrong.
 */
function stubCollection(results: unknown[] = []) {
  const captured: { pipeline?: unknown[] } = {};

  return {
    captured,
    collection: {
      aggregate: (pipeline: unknown[]) => {
        captured.pipeline = pipeline;
        return { toArray: async () => results };
      },
    },
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
  it('queries the index the embedder writes for', async () => {
    const { captured, collection } = stubCollection();

    await searchUnits(collection as never, 'a question', {
      apiKey: 'k',
      fetchImpl: embedOnce() as never,
    });

    const stage = (captured.pipeline?.[0] as Record<string, Record<string, unknown>>)[
      '$vectorSearch'
    ];

    expect(stage?.['index']).toBe(VECTOR_INDEX_NAME);
    expect(stage?.['path']).toBe('embedding');
  });

  it('always filters to the current model', async () => {
    // Vectors from different models occupy unrelated spaces; mixing them
    // would produce scores that mean nothing.
    const { captured, collection } = stubCollection();

    await searchUnits(collection as never, 'q', {
      apiKey: 'k',
      fetchImpl: embedOnce() as never,
    });

    const stage = (captured.pipeline?.[0] as Record<string, Record<string, unknown>>)[
      '$vectorSearch'
    ];
    const filter = stage?.['filter'] as Record<string, unknown>;

    expect(filter['embeddingModel']).toBe(EMBEDDING_MODEL);
  });

  it('passes through the filters the index declares', async () => {
    const { captured, collection } = stubCollection();

    await searchUnits(collection as never, 'q', {
      apiKey: 'k',
      translation: 'bsb',
      unitType: 'passage',
      bookId: 'rom',
      fetchImpl: embedOnce() as never,
    });

    const stage = (captured.pipeline?.[0] as Record<string, Record<string, unknown>>)[
      '$vectorSearch'
    ];
    const filter = stage?.['filter'] as Record<string, unknown>;

    // Upper-cased to match how documents store them.
    expect(filter['translation']).toBe('BSB');
    expect(filter['bookId']).toBe('ROM');
    expect(filter['unitType']).toBe('passage');
  });

  it('considers far more candidates than it returns', async () => {
    // Too few candidates and relevant hits are discarded before scoring.
    const { captured, collection } = stubCollection();

    await searchUnits(collection as never, 'q', {
      apiKey: 'k',
      limit: 5,
      fetchImpl: embedOnce() as never,
    });

    const stage = (captured.pipeline?.[0] as Record<string, Record<string, unknown>>)[
      '$vectorSearch'
    ];

    expect(stage?.['limit']).toBe(5);
    expect(stage?.['numCandidates'] as number).toBeGreaterThanOrEqual(100);
  });

  it('projects the relevance score', async () => {
    const { captured, collection } = stubCollection();

    await searchUnits(collection as never, 'q', {
      apiKey: 'k',
      fetchImpl: embedOnce() as never,
    });

    const project = (captured.pipeline?.[1] as Record<string, Record<string, unknown>>)[
      '$project'
    ];

    expect(project?.['score']).toEqual({ $meta: 'vectorSearchScore' });
  });

  it('embeds the question as a query, not a document', async () => {
    // Voyage prepends a different instruction for each. Mismatching them is
    // the easiest retrieval bug to introduce and the hardest to notice.
    const fetchImpl = embedOnce();
    const { collection } = stubCollection();

    await searchUnits(collection as never, 'q', {
      apiKey: 'k',
      fetchImpl: fetchImpl as never,
    });

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
