import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Reading preferences — design spec §6.
 *
 * Text scaling is an accessibility requirement (AGENTS.md §32), not a
 * cosmetic setting.
 */
export type ReadingDensity = 'compact' | 'comfortable' | 'spacious';

export interface PreferencesState {
  scriptureFontScale: number;
  readingDensity: ReadingDensity;
  showVerseNumbers: boolean;
  redLetter: boolean;
}

const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 2.0;

const initialState: PreferencesState = {
  scriptureFontScale: 1,
  readingDensity: 'comfortable',
  showVerseNumbers: true,
  redLetter: false,
};

export const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    /** Clamped so text scaling cannot render the reader unusable. */
    setScriptureFontScale(state, action: PayloadAction<number>) {
      state.scriptureFontScale = Math.min(
        MAX_FONT_SCALE,
        Math.max(MIN_FONT_SCALE, action.payload),
      );
    },

    setReadingDensity(state, action: PayloadAction<ReadingDensity>) {
      state.readingDensity = action.payload;
    },

    toggleVerseNumbers(state) {
      state.showVerseNumbers = !state.showVerseNumbers;
    },

    setRedLetter(state, action: PayloadAction<boolean>) {
      state.redLetter = action.payload;
    },
  },
});

export const {
  setScriptureFontScale,
  setReadingDensity,
  toggleVerseNumbers,
  setRedLetter,
} = preferencesSlice.actions;

export { MIN_FONT_SCALE, MAX_FONT_SCALE };
