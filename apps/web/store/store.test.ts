import { describe, expect, it } from 'vitest';
import type { BookId, TranslationCode } from '@scrinode/types';
import { makeStore } from './index';
import { setReference, setTranslation } from './scripture.slice';

describe('makeStore', () => {
  it('registers every slice', () => {
    const state = makeStore().getState();

    expect(state.scripture).toBeDefined();
    expect(state.preferences).toBeDefined();
    expect(state.api).toBeDefined();
  });

  it('gives each call an isolated store', () => {
    // A module-level singleton would leak one user's state into another's
    // request under SSR.
    const first = makeStore();
    const second = makeStore();

    first.dispatch(setTranslation('KJV' as TranslationCode));

    expect(first.getState().scripture.translation).toBe('KJV');
    expect(second.getState().scripture.translation).toBe('WEB');
  });

  it('applies dispatched actions', () => {
    const store = makeStore();
    const reference = { bookId: 'ROM' as BookId, chapter: 8, verseStart: 28 };

    store.dispatch(setReference(reference));

    expect(store.getState().scripture.reference).toEqual(reference);
  });
});
