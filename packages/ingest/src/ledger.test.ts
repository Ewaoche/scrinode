import { describe, expect, it } from 'vitest';
import { isUpToDate, reasonToRun, runId, type IngestRun } from './ledger.js';
import type { Manifest } from './layout.js';

const manifest = (sha: string): Manifest => ({
  translation: 'BSB',
  translationName: 'Berean Standard Bible',
  release: '2026-08-08',
  sourceUrl: 'https://ebible.org/Scriptures/details.php?id=engbsb',
  licenceName: 'Public domain',
  licenceUrl: 'https://berean.bible/terms.htm',
  rightsHolder: 'public domain',
  archiveSha256: sha,
  archiveBytes: 100,
  fetchedAt: '2026-09-20T00:00:00.000Z',
  books: [],
  totals: { books: 66, chapters: 1189, verses: 31086 },
  skipped: [],
});

const run = (overrides: Partial<IngestRun> = {}): IngestRun => ({
  _id: 'BSB:2026-08-08:load',
  translation: 'BSB',
  release: '2026-08-08',
  stage: 'load',
  archiveSha256: 'aaa',
  status: 'completed',
  startedAt: new Date('2026-09-20T00:00:00Z'),
  ...overrides,
});

describe('runId', () => {
  it('is deterministic so a retry updates one row', () => {
    expect(runId('bsb', '2026-08-08', 'load')).toBe('BSB:2026-08-08:load');
    expect(runId('BSB', '2026-08-08', 'load')).toBe(runId('bsb', '2026-08-08', 'load'));
  });

  it('separates stages for the same release', () => {
    expect(runId('BSB', '2026-08-08', 'upload')).not.toBe(runId('BSB', '2026-08-08', 'load'));
  });
});

describe('isUpToDate', () => {
  /**
   * These four cases are the whole idempotency guarantee. Work is skipped
   * only when a previous run finished against the same publisher bytes.
   */

  it('skips work when a completed run matches the source hash', () => {
    expect(isUpToDate(run({ archiveSha256: 'aaa' }), manifest('aaa'))).toBe(true);
  });

  it('redoes work when the source changed', () => {
    expect(isUpToDate(run({ archiveSha256: 'aaa' }), manifest('bbb'))).toBe(false);
  });

  it('redoes work when the previous run failed', () => {
    expect(isUpToDate(run({ status: 'failed' }), manifest('aaa'))).toBe(false);
  });

  it('redoes work when a previous run never finished', () => {
    // A row still marked running may have been interrupted, so its output
    // cannot be assumed complete.
    expect(isUpToDate(run({ status: 'running' }), manifest('aaa'))).toBe(false);
  });

  it('does the work when nothing has run before', () => {
    expect(isUpToDate(null, manifest('aaa'))).toBe(false);
  });
});

describe('reasonToRun', () => {
  it('explains every decision an operator will see', () => {
    expect(reasonToRun(null, manifest('aaa'))).toBe('first run');
    expect(reasonToRun(run({ status: 'failed' }), manifest('aaa'))).toBe('previous run failed');
    expect(reasonToRun(run({ status: 'running' }), manifest('aaa'))).toBe(
      'previous run did not finish',
    );
    expect(reasonToRun(run({ archiveSha256: 'aaa' }), manifest('bbb'))).toBe('source changed');
    expect(reasonToRun(run({ archiveSha256: 'aaa' }), manifest('aaa'))).toBe('up to date');
  });
});
