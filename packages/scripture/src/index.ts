/**
 * @scrinode/scripture — canonical reference handling.
 *
 * AGENTS.md §42: reference parsing lives here and is never duplicated.
 */

export { BOOKS, getBook, isValidBookId, type BookMeta } from './books.js';

export {
  IS_COMMERCIAL_PRODUCT,
  TRANSLATIONS,
  availableTranslations,
  getTranslation,
  isAvailable,
  isKnownTranslation,
  requiredAttribution,
  type TranslationMeta,
  type TranslationStatus,
} from './translations.js';

export {
  InvalidReferenceError,
  expandToVerseIds,
  formatCanonical,
  formatDisplay,
  parseCanonical,
  referencesEqual,
  toCanonicalVerseId,
  tryParseCanonical,
  verseCount,
} from './reference.js';
