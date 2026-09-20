/**
 * @scrinode/scripture — canonical reference handling.
 *
 * AGENTS.md §42: reference parsing lives here and is never duplicated.
 */

export {
  ALL_BOOKS,
  BOOKS,
  DEUTEROCANONICAL_BOOKS,
  USFM_NON_BOOK_CODES,
  canonOf,
  getAnyBook,
  getBook,
  isDeuterocanonical,
  isKnownBookId,
  isValidBookId,
  type BookMeta,
} from './books.js';

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
