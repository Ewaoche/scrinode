import type { Citation } from './provenance.js';

/**
 * Zedek's streaming protocol (AGENTS.md §18).
 *
 * Declared here rather than in the app because the producer is the API and
 * the consumer is `apps/zedek` — two packages that must agree exactly, and a
 * shared type is the only thing that makes a protocol change visible to both
 * at compile time.
 *
 * SSE rather than WebSocket: the traffic is one-directional once a request
 * starts, and SSE reconnects on its own. §18 may revisit this if Zedek ever
 * needs the client to speak mid-response.
 */
export type ZedekStreamEvent =
  /**
   * Progress, for the reader. §18 fixes the permitted set, and the reason is
   * §2.4 plus "never expose private chain-of-thought": a status may say which
   * *stage* is running, never what the model is thinking.
   */
  | { readonly type: 'status'; readonly message: ZedekStatus }

  /** A fragment of the answer. Concatenating every delta yields the message. */
  | { readonly type: 'content'; readonly delta: string }

  /**
   * A citation, emitted as it is resolved rather than batched at the end, so
   * the reader can verify a claim while the answer is still arriving (§1's
   * VERIFY step).
   */
  | { readonly type: 'citation'; readonly citation: Citation }

  /** Tool lifecycle, for showing what Zedek is consulting. */
  | { readonly type: 'tool'; readonly tool: string; readonly state: 'started' | 'completed' }

  /**
   * A failure the reader should see. Never carries an exception message: §33
   * keeps infrastructure detail off the wire, and a stack trace tells an
   * attacker more than it tells a reader.
   */
  | { readonly type: 'error'; readonly message: string }

  /** The message is complete and persisted. Carries the id it was saved as. */
  | { readonly type: 'complete'; readonly messageId: string };

/**
 * The statuses Zedek may report.
 *
 * A closed set, not free text. §18 lists these, and typing them means a new
 * status is a deliberate addition rather than a string someone invented in a
 * handler — which is how "Thinking about whether the user is wrong" ends up
 * in production.
 */
export type ZedekStatus =
  | 'Loading Scripture...'
  | 'Searching cross-references...'
  | 'Examining original language...'
  | 'Searching sources...'
  | 'Generating response...';

/** What a client sends to start a turn. */
export interface ZedekRequest {
  readonly conversationId: string;
  readonly content: string;
}
