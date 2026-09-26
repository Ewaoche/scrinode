import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BibleReference, TranslationCode } from '@scrinode/types';

/**
 * Active Scripture state — AGENTS.md §11 and §26.
 *
 * This holds the context that must survive navigation between Scripture,
 * Study, Zedek, Work and Library. It holds interaction state only: Bible
 * corpora belong in RTK Query's cache, never in Redux (§26).
 */
export type ReaderMode = 'standard' | 'focus' | 'compare';

export interface ScriptureState {
  reference?: BibleReference;
  translation: TranslationCode;
  selection?: { startVerse: number; endVerse: number };
  selectedText?: string;
  comparisonTranslations: TranslationCode[];
  readerMode: ReaderMode;
}

const initialState: ScriptureState = {
  // WEB is public domain, so it is a safe default before the licensing
  // matrix is settled.
  translation: 'WEB' as TranslationCode,
  comparisonTranslations: [],
  readerMode: 'standard',
};

export const scriptureSlice = createSlice({
  name: 'scripture',
  initialState,
  reducers: {
    /** Navigating to a passage clears any selection scoped to the old one. */
    setReference(state, action: PayloadAction<BibleReference>) {
      state.reference = action.payload;
      delete state.selection;
      delete state.selectedText;
    },

    /** Changing translation preserves the passage (MVP acceptance criteria). */
    setTranslation(state, action: PayloadAction<TranslationCode>) {
      state.translation = action.payload;
    },

    setSelection(
      state,
      action: PayloadAction<{ startVerse: number; endVerse: number; text?: string }>,
    ) {
      const { startVerse, endVerse, text } = action.payload;
      state.selection = { startVerse, endVerse };

      if (text === undefined) {
        delete state.selectedText;
      } else {
        state.selectedText = text;
      }
    },

    clearSelection(state) {
      delete state.selection;
      delete state.selectedText;
    },

    setReaderMode(state, action: PayloadAction<ReaderMode>) {
      state.readerMode = action.payload;
    },

    addComparisonTranslation(state, action: PayloadAction<TranslationCode>) {
      if (!state.comparisonTranslations.includes(action.payload)) {
        state.comparisonTranslations.push(action.payload);
      }
    },

    removeComparisonTranslation(state, action: PayloadAction<TranslationCode>) {
      state.comparisonTranslations = state.comparisonTranslations.filter(
        (code) => code !== action.payload,
      );
    },
  },
});

export const {
  setReference,
  setTranslation,
  setSelection,
  clearSelection,
  setReaderMode,
  addComparisonTranslation,
  removeComparisonTranslation,
} = scriptureSlice.actions;
