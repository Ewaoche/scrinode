'use client';

import { useCallback, useRef, useState } from 'react';
import type { Citation, ZedekStatus, ZedekStreamEvent } from '@scrinode/types';

/**
 * Consumes Zedek's SSE stream (AGENTS.md §18).
 *
 * `fetch` with a reader rather than `EventSource`, for two reasons that are
 * not stylistic: EventSource cannot issue a POST, and a turn carries a request
 * body; and it cannot send credentials to another origin, which Zedek needs
 * because the API is a separate deployment (§30).
 *
 * Cancellation is required by §18 and is the reason an AbortController is held
 * rather than created per call — a reader who asks a better question should not
 * be paying for the previous answer to finish.
 */
export interface ZedekTurn {
  readonly content: string;
  readonly citations: readonly Citation[];
  readonly status: ZedekStatus | undefined;
  readonly tools: readonly string[];
  readonly error: string | undefined;
  readonly streaming: boolean;
}

const EMPTY: ZedekTurn = {
  content: '',
  citations: [],
  status: undefined,
  tools: [],
  error: undefined,
  streaming: false,
};

export function useZedekStream(endpoint: string) {
  const [turn, setTurn] = useState<ZedekTurn>(EMPTY);
  const abort = useRef<AbortController | undefined>(undefined);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = undefined;
    setTurn((prev) => ({ ...prev, streaming: false, status: undefined }));
  }, []);

  const send = useCallback(
    async (conversationId: string, content: string): Promise<void> => {
      // A new turn supersedes whatever is in flight.
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      setTurn({ ...EMPTY, streaming: true });

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // The API is a separate origin, so the session cookie must be sent
          // explicitly. Its CORS allow-list names this origin (§33).
          credentials: 'include',
          body: JSON.stringify({ conversationId, content }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('stream failed');
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += value;

          // SSE frames are separated by a blank line. A chunk may split one,
          // so the tail stays buffered rather than being parsed early.
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;

            let event: ZedekStreamEvent;
            try {
              event = JSON.parse(line.slice(5).trim()) as ZedekStreamEvent;
            } catch {
              // A malformed frame is dropped rather than failing the turn: the
              // rest of the answer is still worth delivering.
              continue;
            }

            setTurn((prev) => reduce(prev, event));
          }
        }
      } catch {
        // An abort is a reader decision, not a failure to report.
        if (controller.signal.aborted) return;

        setTurn((prev) => ({
          ...prev,
          streaming: false,
          // Never the underlying message: §33 keeps infrastructure detail off
          // the wire, and it is not actionable by a reader.
          error: 'Zedek could not complete that. Please try again.',
        }));
      }
    },
    [endpoint],
  );

  return { turn, send, cancel };
}

/** Applies one event. Pure, so it can be tested without a network. */
export function reduce(turn: ZedekTurn, event: ZedekStreamEvent): ZedekTurn {
  switch (event.type) {
    case 'status':
      return { ...turn, status: event.message };

    case 'content':
      return { ...turn, content: turn.content + event.delta };

    case 'citation':
      return { ...turn, citations: [...turn.citations, event.citation] };

    case 'tool':
      return event.state === 'started'
        ? { ...turn, tools: [...turn.tools, event.tool] }
        : { ...turn, tools: turn.tools.filter((t) => t !== event.tool) };

    case 'error':
      return { ...turn, error: event.message, streaming: false, status: undefined };

    case 'complete':
      return { ...turn, streaming: false, status: undefined };
  }
}
