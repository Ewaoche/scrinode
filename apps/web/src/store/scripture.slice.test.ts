import { describe, expect, it } from 'vitest';
import type { BibleReference, BookId, TranslationCode } from '@scrinode/types';
import {
  addComparisonTranslation,
  clearSelection,
  removeComparisonTranslation,
  scriptureSlice,
  setReaderMode,
  setReference,
  setSelection,
  setTranslation,
} from './scripture.slice';

const reducer = scriptureSlice.reducer;
const initial = () => reducer(undefined, { type: '@@INIT' });

const romans828: BibleReference = {
  bookId: 'ROM' as BookId,
  chapter: 8,
  verseStart: 28,
};

const john316: BibleReference = {
  bookId: 'JHN' as BookId,
  chapter: 3,
  verseStart: 16,
};

describe('scriptureSlice', () => {
  it('defaults to a public-domain translation', () => {
    expect(initial().translation).toBe('WEB');
  });

  it('starts in standard reader mode with no selection', () => {
    const state = initial();
    expect(state.readerMode).toBe('standard');
    expect(state.selection).toBeUndefined();
    expect(state.reference).toBeUndefined();
  });

  describe('setReference', () => {
    it('sets the active reference', () => {
      expect(reducer(initial(), setReference(romans828)).reference).toEqual(romans828);
    });

    it('clears a selection scoped to the previous passage', () => {
      let state = reducer(initial(), setReference(romans828));
      state = reducer(state, setSelection({ startVerse: 28, endVerse: 30, text: 'And we know' }));
      state = reducer(state, setReference(john316));

      // A selection from Romans is meaningless once John is open.
      expect(state.selection).toBeUndefined();
      expect(state.selectedText).toBeUndefined();
    });
  });

  describe('setTranslation', () => {
    it('changes the translation', () => {
      const state = reducer(initial(), setTranslation('KJV' as TranslationCode));
      expect(state.translation).toBe('KJV');
    });

    it('preserves the current passage', () => {
      // MVP acceptance criterion: changing translation must not lose the
      // user's place.
      let state = reducer(initial(), setReference(romans828));
      state = reducer(state, setTranslation('KJV' as TranslationCode));

      expect(state.reference).toEqual(romans828);
    });

    it('preserves the current selection', () => {
      let state = reducer(initial(), setReference(romans828));
      state = reducer(state, setSelection({ startVerse: 28, endVerse: 30 }));
      state = reducer(state, setTranslation('ASV' as TranslationCode));

      expect(state.selection).toEqual({ startVerse: 28, endVerse: 30 });
    });
  });

  describe('setSelection', () => {
    it('records a verse range', () => {
      const state = reducer(initial(), setSelection({ startVerse: 28, endVerse: 30 }));
      expect(state.selection).toEqual({ startVerse: 28, endVerse: 30 });
    });

    it('records the selected text when given', () => {
      const state = reducer(initial(), setSelection({ startVerse: 28, endVerse: 28, text: 'And we know' }));
      expect(state.selectedText).toBe('And we know');
    });

    it('drops stale text when a new selection omits it', () => {
      let state = reducer(initial(), setSelection({ startVerse: 1, endVerse: 1, text: 'first' }));
      state = reducer(state, setSelection({ startVerse: 2, endVerse: 2 }));

      expect(state.selectedText).toBeUndefined();
    });
  });

  describe('clearSelection', () => {
    it('removes selection and text', () => {
      let state = reducer(initial(), setSelection({ startVerse: 1, endVerse: 2, text: 'x' }));
      state = reducer(state, clearSelection());

      expect(state.selection).toBeUndefined();
      expect(state.selectedText).toBeUndefined();
    });

    it('leaves the reference intact', () => {
      let state = reducer(initial(), setReference(romans828));
      state = reducer(state, clearSelection());

      expect(state.reference).toEqual(romans828);
    });
  });

  describe('comparison translations', () => {
    it('adds a translation', () => {
      const state = reducer(initial(), addComparisonTranslation('KJV' as TranslationCode));
      expect(state.comparisonTranslations).toEqual(['KJV']);
    });

    it('does not add a duplicate', () => {
      let state = reducer(initial(), addComparisonTranslation('KJV' as TranslationCode));
      state = reducer(state, addComparisonTranslation('KJV' as TranslationCode));

      expect(state.comparisonTranslations).toEqual(['KJV']);
    });

    it('removes a translation', () => {
      let state = reducer(initial(), addComparisonTranslation('KJV' as TranslationCode));
      state = reducer(state, addComparisonTranslation('ASV' as TranslationCode));
      state = reducer(state, removeComparisonTranslation('KJV' as TranslationCode));

      expect(state.comparisonTranslations).toEqual(['ASV']);
    });
  });

  describe('setReaderMode', () => {
    it('switches mode', () => {
      expect(reducer(initial(), setReaderMode('compare')).readerMode).toBe('compare');
    });
  });
});
