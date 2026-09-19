import type { BookId, Testament } from '@scrinode/types';

/**
 * Canonical book registry — 66 books, Protestant canon, canonical order.
 *
 * Book IDs follow the three-letter convention used throughout Scrinode
 * (AGENTS.md §10). Chapter counts are structural facts about the canon.
 *
 * Per-chapter verse counts are NOT stored here: they vary between
 * translations and versification traditions, so they belong with imported
 * translation data carrying its own provenance (AGENTS.md §21). Do not
 * invent them.
 */

export interface BookMeta {
  readonly id: BookId;
  readonly name: string;
  readonly testament: Testament;
  readonly order: number;
  readonly chapters: number;
}

const book = (
  id: string,
  name: string,
  testament: Testament,
  order: number,
  chapters: number,
): BookMeta => ({ id: id as BookId, name, testament, order, chapters });

export const BOOKS: readonly BookMeta[] = [
  // Old Testament
  book('GEN', 'Genesis', 'OT', 1, 50),
  book('EXO', 'Exodus', 'OT', 2, 40),
  book('LEV', 'Leviticus', 'OT', 3, 27),
  book('NUM', 'Numbers', 'OT', 4, 36),
  book('DEU', 'Deuteronomy', 'OT', 5, 34),
  book('JOS', 'Joshua', 'OT', 6, 24),
  book('JDG', 'Judges', 'OT', 7, 21),
  book('RUT', 'Ruth', 'OT', 8, 4),
  book('1SA', '1 Samuel', 'OT', 9, 31),
  book('2SA', '2 Samuel', 'OT', 10, 24),
  book('1KI', '1 Kings', 'OT', 11, 22),
  book('2KI', '2 Kings', 'OT', 12, 25),
  book('1CH', '1 Chronicles', 'OT', 13, 29),
  book('2CH', '2 Chronicles', 'OT', 14, 36),
  book('EZR', 'Ezra', 'OT', 15, 10),
  book('NEH', 'Nehemiah', 'OT', 16, 13),
  book('EST', 'Esther', 'OT', 17, 10),
  book('JOB', 'Job', 'OT', 18, 42),
  book('PSA', 'Psalms', 'OT', 19, 150),
  book('PRO', 'Proverbs', 'OT', 20, 31),
  book('ECC', 'Ecclesiastes', 'OT', 21, 12),
  book('SNG', 'Song of Solomon', 'OT', 22, 8),
  book('ISA', 'Isaiah', 'OT', 23, 66),
  book('JER', 'Jeremiah', 'OT', 24, 52),
  book('LAM', 'Lamentations', 'OT', 25, 5),
  book('EZK', 'Ezekiel', 'OT', 26, 48),
  book('DAN', 'Daniel', 'OT', 27, 12),
  book('HOS', 'Hosea', 'OT', 28, 14),
  book('JOL', 'Joel', 'OT', 29, 3),
  book('AMO', 'Amos', 'OT', 30, 9),
  book('OBA', 'Obadiah', 'OT', 31, 1),
  book('JON', 'Jonah', 'OT', 32, 4),
  book('MIC', 'Micah', 'OT', 33, 7),
  book('NAM', 'Nahum', 'OT', 34, 3),
  book('HAB', 'Habakkuk', 'OT', 35, 3),
  book('ZEP', 'Zephaniah', 'OT', 36, 3),
  book('HAG', 'Haggai', 'OT', 37, 2),
  book('ZEC', 'Zechariah', 'OT', 38, 14),
  book('MAL', 'Malachi', 'OT', 39, 4),

  // New Testament
  book('MAT', 'Matthew', 'NT', 40, 28),
  book('MRK', 'Mark', 'NT', 41, 16),
  book('LUK', 'Luke', 'NT', 42, 24),
  book('JHN', 'John', 'NT', 43, 21),
  book('ACT', 'Acts', 'NT', 44, 28),
  book('ROM', 'Romans', 'NT', 45, 16),
  book('1CO', '1 Corinthians', 'NT', 46, 16),
  book('2CO', '2 Corinthians', 'NT', 47, 13),
  book('GAL', 'Galatians', 'NT', 48, 6),
  book('EPH', 'Ephesians', 'NT', 49, 6),
  book('PHP', 'Philippians', 'NT', 50, 4),
  book('COL', 'Colossians', 'NT', 51, 4),
  book('1TH', '1 Thessalonians', 'NT', 52, 5),
  book('2TH', '2 Thessalonians', 'NT', 53, 3),
  book('1TI', '1 Timothy', 'NT', 54, 6),
  book('2TI', '2 Timothy', 'NT', 55, 4),
  book('TIT', 'Titus', 'NT', 56, 3),
  book('PHM', 'Philemon', 'NT', 57, 1),
  book('HEB', 'Hebrews', 'NT', 58, 13),
  book('JAS', 'James', 'NT', 59, 5),
  book('1PE', '1 Peter', 'NT', 60, 5),
  book('2PE', '2 Peter', 'NT', 61, 3),
  book('1JN', '1 John', 'NT', 62, 5),
  book('2JN', '2 John', 'NT', 63, 1),
  book('3JN', '3 John', 'NT', 64, 1),
  book('JUD', 'Jude', 'NT', 65, 1),
  book('REV', 'Revelation', 'NT', 66, 22),
];

const BY_ID = new Map<string, BookMeta>(BOOKS.map((b) => [b.id, b]));

export function getBook(id: BookId | string): BookMeta | undefined {
  return BY_ID.get(id.toUpperCase());
}

export function isValidBookId(id: string): id is BookId {
  return BY_ID.has(id.toUpperCase());
}
