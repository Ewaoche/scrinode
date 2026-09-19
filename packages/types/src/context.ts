import type { BibleReference, TranslationCode } from './scripture.js';

/**
 * The active Scripture context — AGENTS.md §11.
 *
 * This object must survive navigation between Scripture, Study, Zedek, Work
 * and Library. Feature implementations accept a ScriptureContext rather than
 * independently parsing URL strings.
 */
export interface ScriptureContext {
  readonly reference: BibleReference;
  readonly translation: TranslationCode;

  readonly selection?: {
    readonly startVerse: number;
    readonly endVerse: number;
  };

  readonly selectedText?: string;
  readonly selectedTokens?: readonly string[];

  readonly comparisonTranslations?: readonly TranslationCode[];
}

/** How much of the text a user has selected, per the design spec §7.2. */
export type SelectionScope = 'word' | 'phrase' | 'verse' | 'passage';
