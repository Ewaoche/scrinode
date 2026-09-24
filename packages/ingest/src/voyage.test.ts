import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMBED_BATCH_SIZE,
  RATE_LIMIT_BACKOFF_MS,
  VoyageError,
  batched,
  embedBatch,
} from './voyage.js';
import { EMBEDDING_DIMENSIONS } from './retrieval.js';

/** A well-formed response for `count` texts. */
const ok = (count: number): Response =>
  new Response(
    JSON.stringify({
      data: Array.from({ length: count }, (_, i) => ({
        embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01),
        index: i,
      })),
      usage: { total_tokens: count * 10 },
    }),
    { status: 200 },
  );

const options = (fetchImpl: typeof fetch, maxAttempts = 3) => ({
  apiKey: 'test-key',
  fetchImpl,
  maxAttempts,
});

describe('embedBatch', () => {
  it('returns one embedding per text', async () => {
    const fetchImpl = vi.fn(async () => ok(3));
    const result = await embedBatch(['a', 'b', 'c'], 'document', options(fetchImpl as never));

    expect(result.embeddings).toHaveLength(3);
    expect(result.embeddings[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(result.totalTokens).toBe(30);
  });

  it('sends the API key as a bearer token', async () => {
    const fetchImpl = vi.fn(async () => ok(1));
    await embedBatch(['a'], 'document', options(fetchImpl as never));

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
  });

  it('sends the input type, which Voyage instructs differently', async () => {
    // Embedding a stored document as if it were a query measurably degrades
    // retrieval, so this must reach the API.
    const fetchImpl = vi.fn(async () => ok(1));
    await embedBatch(['a'], 'document', options(fetchImpl as never));

    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.input_type).toBe('document');
    expect(body.truncation).toBe(true);
  });

  it('returns embeddings in the order the texts were given', async () => {
    // The response shape carries an index; arrival order is not guaranteed.
    const shuffled = new Response(
      JSON.stringify({
        data: [
          { embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 2), index: 1 },
          { embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1), index: 0 },
        ],
        usage: { total_tokens: 4 },
      }),
      { status: 200 },
    );

    const result = await embedBatch(
      ['first', 'second'],
      'document',
      options(vi.fn(async () => shuffled) as never),
    );

    expect(result.embeddings[0]?.[0]).toBe(1);
    expect(result.embeddings[1]?.[0]).toBe(2);
  });

  it('does nothing for an empty batch', async () => {
    const fetchImpl = vi.fn();
    const result = await embedBatch([], 'document', options(fetchImpl as never));

    expect(result.embeddings).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a batch beyond Voyage's documented limit", async () => {
    const texts = Array.from({ length: 1001 }, () => 'x');
    await expect(
      embedBatch(texts, 'document', options(vi.fn() as never)),
    ).rejects.toThrow(/at most 1000/);
  });
});

describe('dimension validation', () => {
  it('rejects a response whose dimensions would break the index', async () => {
    // The halfvec column declares its width. A mismatch is rejected at
    // insert time with an error naming the column rather than the model, so
    // catching it here names the real cause.
    const wrong = new Response(
      JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
        usage: { total_tokens: 1 },
      }),
      { status: 200 },
    );

    await expect(
      embedBatch(['a'], 'document', options(vi.fn(async () => wrong) as never)),
    ).rejects.toThrow(/Expected 1024 dimensions/);
  });

  it('rejects a response with the wrong number of embeddings', async () => {
    const short = new Response(
      JSON.stringify({ data: [{ embedding: [], index: 0 }], usage: {} }),
      { status: 200 },
    );

    await expect(
      embedBatch(['a', 'b'], 'document', options(vi.fn(async () => short) as never)),
    ).rejects.toThrow(/1 embeddings for 2 texts/);
  });
});

describe('retries', () => {
  /**
   * A rate limit now waits twenty seconds, which is correct against the API
   * and far too long for a test suite. Fake timers let the wait be asserted
   * without anyone sitting through it.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Run a call to completion, advancing timers past every backoff. */
  const settle = async <T,>(promise: Promise<T>): Promise<T> => {
    const result = promise.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );

    // Each advance releases one pending sleep; five covers the attempt
    // budget with room to spare.
    for (let i = 0; i < 8; i += 1) {
      await vi.advanceTimersByTimeAsync(60_000);
    }

    const settled = await result;
    if (settled.ok) return settled.value;
    throw settled.error;
  };

  it('waits long enough for a per-minute rate limit to clear', async () => {
    // A free Voyage account is capped at 3 requests and 10K tokens per
    // minute. A sub-second backoff guarantees another 429 and burns the
    // attempt budget without ever leaving the window.
    const waits: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(ok(1));

    await settle(
      embedBatch(['a'], 'document', {
        apiKey: 'k',
        fetchImpl: fetchImpl as never,
        maxAttempts: 3,
        onRetry: ({ delayMs }) => waits.push(delayMs),
      }),
    );

    expect(waits[0]).toBeGreaterThanOrEqual(RATE_LIMIT_BACKOFF_MS);
  });

  it('honours Retry-After when the API sends one', async () => {
    const waits: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }),
      )
      .mockResolvedValueOnce(ok(1));

    await settle(
      embedBatch(['a'], 'document', {
        apiKey: 'k',
        fetchImpl: fetchImpl as never,
        maxAttempts: 3,
        onRetry: ({ delayMs }) => waits.push(delayMs),
      }),
    );

    expect(waits[0]).toBe(2000);
  });

  it('keeps server faults on a short backoff', async () => {
    // A 5xx is usually transient and carries no per-minute window, so it
    // should not wait as long as a rate limit.
    const waits: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('oops', { status: 503 }))
      .mockResolvedValueOnce(ok(1));

    await settle(
      embedBatch(['a'], 'document', {
        apiKey: 'k',
        fetchImpl: fetchImpl as never,
        maxAttempts: 3,
        onRetry: ({ delayMs }) => waits.push(delayMs),
      }),
    );

    expect(waits[0]).toBeLessThan(RATE_LIMIT_BACKOFF_MS);
  });

  it('retries a rate limit and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429 }))
      .mockResolvedValueOnce(ok(1));

    const result = await settle(embedBatch(['a'], 'document', options(fetchImpl as never)));

    expect(result.embeddings).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a server fault', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockResolvedValueOnce(ok(1));

    await settle(embedBatch(['a'], 'document', options(fetchImpl as never)));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a bad key', async () => {
    // Repeating a 401 wastes time and hides the real problem.
    const fetchImpl = vi.fn(async () => new Response('unauthorized', { status: 401 }));

    await expect(settle(embedBatch(['a'], 'document', options(fetchImpl as never)))).rejects.toThrow(
      VoyageError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry a malformed request', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad request', { status: 400 }));

    await expect(settle(embedBatch(['a'], 'document', options(fetchImpl as never)))).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt limit', async () => {
    const fetchImpl = vi.fn(async () => new Response('busy', { status: 429 }));

    await expect(
      settle(embedBatch(['a'], 'document', options(fetchImpl as never, 2))),
    ).rejects.toThrow(/429/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a network failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok(1));

    await settle(embedBatch(['a'], 'document', options(fetchImpl as never)));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('batched', () => {
  it('splits into batches the API accepts', () => {
    const items = Array.from({ length: 300 }, (_, i) => i);
    const batches = batched(items, EMBED_BATCH_SIZE);

    expect(batches.flat()).toHaveLength(300);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(EMBED_BATCH_SIZE);
    }
  });

  it('stays under the documented 1000-text ceiling', () => {
    expect(EMBED_BATCH_SIZE).toBeLessThanOrEqual(1000);
  });

  it('returns nothing for an empty list', () => {
    expect(batched([])).toEqual([]);
  });
});
