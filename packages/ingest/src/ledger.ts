import type { Manifest } from './layout.js';

/**
 * Run ledger — what has been pushed where, and from which bytes.
 *
 * Ingestion runs repeatedly against a growing corpus, and the expensive
 * question each time is "what actually changed?". Answering it by listing
 * remote objects is slow and cannot distinguish an identical file from a
 * changed one; answering it from a local file loses the answer when the
 * machine is rebuilt and hides it from anyone else running the scripts.
 *
 * So the ledger lives in Postgres beside the data it describes. It records
 * the manifest's `archiveSha256`, which is the hash of the publisher's bytes
 * — if that is unchanged, the parsed output is necessarily unchanged too,
 * because parsing is deterministic.
 *
 * This is what makes both scripts idempotent: re-running them is a no-op
 * until a source actually changes.
 */

export const LEDGER_TABLE = 'ingest_runs';

export type IngestStage = 'upload' | 'load';

export type RunStatus = 'running' | 'completed' | 'failed';

/**
 * One stage, for one translation release.
 *
 * `_id` is deterministic so a retry updates the same row rather than piling
 * up history for a run that failed halfway.
 */
export interface IngestRun {
  readonly _id: string;
  readonly translation: string;
  readonly release: string;
  readonly stage: IngestStage;
  /** SHA256 of the publisher archive this run processed. */
  readonly archiveSha256: string;
  readonly status: RunStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  /** Objects written, for `upload`. */
  readonly objectCount?: number;
  /** Verse documents written, for `load`. */
  readonly verseCount?: number;
  /** Books processed. */
  readonly bookCount?: number;
  /** Why a run failed, where it did. */
  readonly error?: string;
  /** Host that ran it, so a shared ledger stays attributable. */
  readonly host?: string;
}

export function runId(translation: string, release: string, stage: IngestStage): string {
  return `${translation.toUpperCase()}:${release}:${stage}`;
}

/**
 * Whether a stage may be skipped.
 *
 * Skipped only when a previous run **completed** against the same archive
 * hash. A run still marked `running` is treated as unfinished — it may have
 * been interrupted — so the work is redone rather than assumed good.
 */
export function isUpToDate(previous: IngestRun | null, manifest: Manifest): boolean {
  if (!previous) return false;
  if (previous.status !== 'completed') return false;
  return previous.archiveSha256 === manifest.archiveSha256;
}

/** Why a stage is being run, for logging. */
export function reasonToRun(previous: IngestRun | null, manifest: Manifest): string {
  if (!previous) return 'first run';
  if (previous.status === 'failed') return 'previous run failed';
  if (previous.status === 'running') return 'previous run did not finish';
  if (previous.archiveSha256 !== manifest.archiveSha256) return 'source changed';
  return 'up to date';
}
