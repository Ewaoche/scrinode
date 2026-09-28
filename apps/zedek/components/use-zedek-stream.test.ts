import { describe, expect, it } from 'vitest';
import { reduce, type ZedekTurn } from './use-zedek-stream';
import type { Citation } from '@scrinode/types';

/**
 * The stream reducer is pure, so §18's protocol can be tested without a
 * network — which matters because the failure modes that hurt (a lost delta,
 * a citation dropped) are invisible in a live session.
 */
const START: ZedekTurn = {
  content: '',
  citations: [],
  status: undefined,
  tools: [],
  error: undefined,
  streaming: true,
};

const CITATION: Citation = {
  kind: 'scripture',
  label: 'Romans 8:28',
  canonicalReference: 'ROM.8.28',
  translation: 'BSB',
  retrievalUnitId: 'BSB:ROM.8.28',
  text: 'And we know that God works all things together for the good of those who love Him.',
};

describe('Zedek stream reducer', () => {
  it('concatenates deltas in order', () => {
    // The whole answer is the sum of its deltas; dropping or reordering one is
    // silent corruption of the text a reader is asked to trust.
    const turn = ['Faith ', 'without ', 'works'].reduce(
      (acc, delta) => reduce(acc, { type: 'content', delta }),
      START,
    );

    expect(turn.content).toBe('Faith without works');
  });

  it('accumulates citations rather than replacing them', () => {
    const second: Citation = { ...CITATION, label: 'James 2:17', retrievalUnitId: 'BSB:JAS.2.17' };

    let turn = reduce(START, { type: 'citation', citation: CITATION });
    turn = reduce(turn, { type: 'citation', citation: second });

    expect(turn.citations).toHaveLength(2);
  });

  it('tracks tools as they start and finish', () => {
    let turn = reduce(START, { type: 'tool', tool: 'searchBible', state: 'started' });
    expect(turn.tools).toEqual(['searchBible']);

    turn = reduce(turn, { type: 'tool', tool: 'searchBible', state: 'completed' });
    expect(turn.tools).toEqual([]);
  });

  it('clears the status when the turn completes', () => {
    // A status left showing after the answer arrived reads as a hung request.
    let turn = reduce(START, { type: 'status', message: 'Generating response...' });
    turn = reduce(turn, { type: 'complete', messageId: 'm1' });

    expect(turn.status).toBeUndefined();
    expect(turn.streaming).toBe(false);
  });

  it('stops streaming on an error and keeps what arrived', () => {
    // A partial answer with its citations is more useful than a blank panel,
    // and discarding it would hide that retrieval had already succeeded.
    let turn = reduce(START, { type: 'content', delta: 'Romans 8 argues ' });
    turn = reduce(turn, { type: 'citation', citation: CITATION });
    turn = reduce(turn, { type: 'error', message: 'Zedek could not finish.' });

    expect(turn.error).toBe('Zedek could not finish.');
    expect(turn.streaming).toBe(false);
    expect(turn.content).toBe('Romans 8 argues ');
    expect(turn.citations).toHaveLength(1);
  });

  it('never mutates the turn it was given', () => {
    // React state depends on this: a mutated object does not re-render.
    const before = { ...START, content: 'x' };
    const after = reduce(before, { type: 'content', delta: 'y' });

    expect(before.content).toBe('x');
    expect(after).not.toBe(before);
  });
});
