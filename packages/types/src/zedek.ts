import type { BibleReference, TranslationCode } from './scripture.js';
import type { Citation } from './provenance.js';

/**
 * Zedek's research primitives — Studies and Conversations (AGENTS.md §3.3).
 *
 * The two names are fixed by §45's product language and must not drift into
 * "project", "session" or "thread" in code any more than in the interface.
 *
 *   Study          a project — a sermon series, a book study, a question
 *   └── Conversation   one thread within it
 *
 * Neither is a new storage primitive. §24 already specifies `workspaces`,
 * `conversations` and `messages`, and §39 says represent relations as rows
 * before reaching for anything richer. A Study is a workspace whose type is
 * `research`; a Conversation carries the workspace id it belongs to.
 */

/** A Study's lifecycle. Archived studies stay readable and stop appearing. */
export type StudyStatus = 'active' | 'archived';

/**
 * A Study — the project a body of research belongs to.
 *
 * `scriptureFocus` is what the Study is *about*, not where the reader
 * currently is. It seeds retrieval (§19) so a conversation about Romans does
 * not have to restate that it is about Romans, and it is the reason memory is
 * per Study rather than per Conversation (§3.3).
 */
export interface Study {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly description?: string;
  readonly status: StudyStatus;

  /** What this Study is about. Empty is valid — a Study may start open-ended. */
  readonly scriptureFocus?: readonly BibleReference[];

  /** The translation this Study works in. Subject to §22.1's availability gate. */
  readonly translation?: TranslationCode;

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A Conversation — one thread of exchange inside a Study.
 *
 * Always belongs to exactly one Study. A conversation with no Study would have
 * nowhere to keep what it learned, which is the whole point of the hierarchy.
 */
export interface Conversation {
  readonly id: string;
  readonly studyId: string;
  readonly userId: string;

  /** Derived from the first message when absent; never invented by a model. */
  readonly title: string;

  /** Where the reader was when this began, if they came from Scripture (§11). */
  readonly openingContext?: {
    readonly reference: BibleReference;
    readonly translation: TranslationCode;
  };

  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type MessageRole = 'user' | 'assistant';

/**
 * One message.
 *
 * §2.4 requires Scripture, interpretation, AI synthesis and user content stay
 * visibly distinct, which starts with keeping them distinct in the data:
 * `content` is prose, `citations` are what it is grounded in, and the two are
 * never merged into one blob for the UI to pull apart.
 */
export interface ZedekMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: MessageRole;
  readonly content: string;

  /** What this message is grounded in. §16 validates these before delivery. */
  readonly citations: readonly Citation[];

  /** Which model produced it, for §34's cost and latency tracking. */
  readonly model?: {
    readonly provider: string;
    readonly name: string;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };

  readonly createdAt: Date;
}

/**
 * What a Study remembers.
 *
 * Deliberately not a transcript. Replaying raw messages into a prompt would
 * defeat §19's retrieval, grow without bound, and spend tokens re-reading what
 * the model already concluded. This is the distilled state: what the Study is
 * about and what it has established.
 */
export interface StudyMemory {
  readonly studyId: string;

  /** Short statements the reader or Zedek has established. Each traceable. */
  readonly findings: readonly {
    readonly text: string;
    readonly citations: readonly Citation[];
    readonly createdAt: Date;
  }[];

  /** References this Study keeps returning to. */
  readonly references: readonly BibleReference[];

  readonly updatedAt: Date;
}
