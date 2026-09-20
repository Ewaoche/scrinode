import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './retrieval.js';

/**
 * Voyage AI embeddings client.
 *
 * Deliberately a plain fetch wrapper rather than a vendor SDK: AGENTS.md §8
 * keeps vendor AI SDKs out of everything but the AI layer, and this runs in
 * the ingestion CLI. The REST contract is small and stable enough that an SDK
 * would add a dependency without adding anything else.
 *
 * Contract verified against Voyage's own reference, 2026-09-20:
 *   POST https://api.voyageai.com/v1/embeddings
 *   Authorization: Bearer <key>
 *   { model, input: string[], input_type, truncation }
 *   -> { data: [{ embedding: number[], index }], usage: { total_tokens } }
 *   Maximum 1,000 texts per request.
 */

const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

/**
 * Voyage's hard limit is 1,000 texts per request. This sits well below it:
 * passages run to a few hundred tokens each, and the per-request token
 * ceiling binds long before the item count does.
 */
export const EMBED_BATCH_SIZE = 128;

/**
 * Base wait after a rate limit, in milliseconds.
 *
 * Voyage's tightest documented window is per minute, so waiting in
 * twenty-second steps clears it within the attempt budget rather than
 * retrying inside the same window.
 */
export const RATE_LIMIT_BACKOFF_MS = 20_000;

/**
 * Whether the text being embedded is a stored document or a search query.
 *
 * Voyage prepends a different instruction for each, and mismatching them
 * measurably degrades retrieval. Everything the embedder writes is a
 * document; Zedek's question at query time is a query.
 */
export type InputType = 'document' | 'query';

export interface EmbeddingResult {
  readonly embeddings: readonly (readonly number[])[];
  readonly totalTokens: number;
}

export class VoyageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'VoyageError';
  }
}

/** Retry only what is worth retrying: rate limits and transient server faults. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface VoyageOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly maxAttempts?: number;
  /** Called before each retry, so a long wait is visible rather than a hang. */
  readonly onRetry?: (info: { attempt: number; status: number; delayMs: number }) => void;
  /** Injected in tests so retry behaviour can be exercised without network. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Embed a batch of texts.
 *
 * Retries rate limits and server faults with exponential backoff. A 401 or a
 * 400 is not retried: the key is wrong or the request is malformed, and
 * repeating it wastes quota and delays the real error.
 */
export async function embedBatch(
  texts: readonly string[],
  inputType: InputType,
  options: VoyageOptions,
): Promise<EmbeddingResult> {
  if (texts.length === 0) return { embeddings: [], totalTokens: 0 };

  if (texts.length > 1000) {
    throw new VoyageError(`Voyage accepts at most 1000 texts per request, received ${texts.length}`);
  }

  const model = options.model ?? EMBEDDING_MODEL;
  const maxAttempts = options.maxAttempts ?? 5;
  const doFetch = options.fetchImpl ?? fetch;
  const onRetry = options.onRetry;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;

    try {
      response = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: texts,
          input_type: inputType,
          // Over-length input is truncated rather than failing the batch. A
          // chapter unit can be long, and losing its tail is better than
          // losing the unit.
          truncation: true,
        }),
      });
    } catch (error) {
      // Network failure, no status to inspect.
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      await sleep(2 ** attempt * 500);
      continue;
    }

    if (response.ok) {
      const payload = (await response.json()) as {
        data?: { embedding?: number[]; index?: number }[];
        usage?: { total_tokens?: number };
      };

      const rows = payload.data ?? [];
      if (rows.length !== texts.length) {
        throw new VoyageError(`Voyage returned ${rows.length} embeddings for ${texts.length} texts`);
      }

      // Order is not guaranteed by the response shape, so sort by index
      // rather than trusting arrival order.
      const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const embeddings = sorted.map((row) => row.embedding ?? []);

      for (const embedding of embeddings) {
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new VoyageError(
            `Expected ${EMBEDDING_DIMENSIONS} dimensions from ${model}, received ${embedding.length}. ` +
              'The Atlas index declares the expected number and will reject these.',
          );
        }
      }

      return { embeddings, totalTokens: payload.usage?.total_tokens ?? 0 };
    }

    const body = await response.text().catch(() => '');
    lastError = new VoyageError(
      `Voyage returned ${response.status}: ${body.slice(0, 200)}`,
      response.status,
    );

    if (!isRetryable(response.status) || attempt === maxAttempts) break;

    // A rate limit needs a wait measured against the limit's window, not a
    // generic backoff. An account without a payment method is capped at 3
    // requests and 10K tokens per minute, so a few hundred milliseconds
    // guarantees another 429 and burns the attempt budget for nothing.
    //
    // Retry-After is honoured when present; otherwise a rate limit waits in
    // multiples of twenty seconds, which clears the tightest documented
    // per-minute window within the attempt budget.
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);

    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : response.status === 429
        ? attempt * RATE_LIMIT_BACKOFF_MS
        : 2 ** attempt * 500;

    onRetry?.({ attempt, status: response.status, delayMs: delay });
    await sleep(delay);
  }

  throw lastError ?? new VoyageError('Voyage request failed');
}

/** Split a list into batches the API will accept. */
export function batched<T>(items: readonly T[], size = EMBED_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
