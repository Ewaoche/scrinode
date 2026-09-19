import { describe, expect, it } from 'vitest';
import {
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  preferencesSlice,
  setReadingDensity,
  setRedLetter,
  setScriptureFontScale,
  toggleVerseNumbers,
} from './preferences.slice';

const reducer = preferencesSlice.reducer;
const initial = () => reducer(undefined, { type: '@@INIT' });

describe('preferencesSlice', () => {
  it('defaults to readable settings', () => {
    const state = initial();
    expect(state.scriptureFontScale).toBe(1);
    expect(state.readingDensity).toBe('comfortable');
    expect(state.showVerseNumbers).toBe(true);
  });

  describe('setScriptureFontScale', () => {
    it('sets a scale within range', () => {
      expect(reducer(initial(), setScriptureFontScale(1.5)).scriptureFontScale).toBe(1.5);
    });

    it('clamps above the maximum', () => {
      // Text scaling must not be able to render the reader unusable.
      expect(reducer(initial(), setScriptureFontScale(99)).scriptureFontScale).toBe(MAX_FONT_SCALE);
    });

    it('clamps below the minimum', () => {
      expect(reducer(initial(), setScriptureFontScale(0.1)).scriptureFontScale).toBe(MIN_FONT_SCALE);
    });

    it('clamps a negative value', () => {
      expect(reducer(initial(), setScriptureFontScale(-5)).scriptureFontScale).toBe(MIN_FONT_SCALE);
    });
  });

  describe('toggleVerseNumbers', () => {
    it('toggles off and back on', () => {
      let state = reducer(initial(), toggleVerseNumbers());
      expect(state.showVerseNumbers).toBe(false);

      state = reducer(state, toggleVerseNumbers());
      expect(state.showVerseNumbers).toBe(true);
    });
  });

  describe('setReadingDensity', () => {
    it('sets density', () => {
      expect(reducer(initial(), setReadingDensity('compact')).readingDensity).toBe('compact');
    });
  });

  describe('setRedLetter', () => {
    it('enables red letter', () => {
      expect(reducer(initial(), setRedLetter(true)).redLetter).toBe(true);
    });
  });
});
