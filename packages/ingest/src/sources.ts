import type { Canon } from '@scrinode/types';

/**
 * The public-domain English texts Scrinode ingests.
 *
 * All 34 texts eBible.org lists with a copyright field reading exactly
 * "public domain", verified 2026-09-20 against
 * <https://ebible.org/Scriptures/translations.csv>.
 *
 * `code` is Scrinode's registry code where one exists
 * (`packages/scripture/src/translations.ts`) and a reasonable short code
 * otherwise. Texts not in the registry are downloaded and staged but must not
 * be served until registered — `isAvailable()` remains the only gate.
 *
 * `ebibleId` is the publisher's own identifier and is what forms the download
 * URL, so nothing here needs a lookup table.
 */

export interface BibleSource {
  /** Scrinode translation code. */
  readonly code: string;
  /** eBible.org translation id, which forms the archive URL. */
  readonly ebibleId: string;
  readonly name: string;
  /** Publication date from eBible's catalogue; becomes the release. */
  readonly release: string;
  /** Canons this edition carries. */
  readonly canons: readonly Canon[];
  /** Registered in translations.ts and therefore servable once loaded. */
  readonly registered: boolean;
  /** Why this text exists in the archive but is not offered to readers. */
  readonly note?: string;
}

const ebible = (
  code: string,
  ebibleId: string,
  name: string,
  release: string,
  canons: readonly Canon[],
  registered: boolean,
  note?: string,
): BibleSource => ({
  code,
  ebibleId,
  name,
  release,
  canons,
  registered,
  ...(note ? { note } : {}),
});

const PROTESTANT: readonly Canon[] = ['protestant'];
const BOTH: readonly Canon[] = ['protestant', 'deuterocanonical'];

export const BIBLE_SOURCES: readonly BibleSource[] = [
  // --- Registered and servable -------------------------------------------
  ebible('BSB', 'engbsb', 'Berean Standard Bible', '2026-08-08', PROTESTANT, true),
  ebible('WEB', 'engwebp', 'World English Bible', '2026-08-08', PROTESTANT, true),
  ebible('KJV', 'eng-kjv2006', 'King James (Authorized) Version', '2026-09-17', PROTESTANT, true),
  ebible('ASV', 'eng-asv', 'American Standard Version (1901)', '2026-08-08', PROTESTANT, true),
  ebible('YLT', 'engylt', "Young's Literal Translation", '2019-10-21', PROTESTANT, true),
  ebible('DBY', 'engDBY', 'Darby Translation', '2019-11-16', PROTESTANT, true),
  ebible('WBT', 'engwebster', 'Noah Webster Bible', '2024-08-01', PROTESTANT, true),
  ebible('GNV', 'enggnv', 'Geneva Bible 1599', '2024-03-16', PROTESTANT, true),
  ebible('BBE', 'engBBE', 'Bible in Basic English', '2018-08-29', PROTESTANT, true),
  ebible('DRA', 'engDRA', 'Douay-Rheims 1899', '2022-11-03', BOTH, true),

  // --- Archived, not yet registered --------------------------------------
  //
  // Downloaded and staged so the corpus is complete and re-import never
  // depends on a publisher staying online. Not servable until added to
  // translations.ts with its licence terms.
  ebible('MSB', 'engmsb', 'Majority Standard Bible', '2026-08-08', PROTESTANT, false),
  ebible('RV', 'eng-rv', 'Revised Version with Apocrypha (1895)', '2024-08-01', BOTH, false),
  ebible('KJVA', 'eng-kjv', 'King James Version with Apocrypha', '2024-08-01', BOTH, false),
  ebible('KJVCPB', 'engkjvcpb', 'KJV Cambridge Paragraph Bible', '2024-08-01', BOTH, false),
  ebible('ASVBT', 'engasvbt', 'American Standard Version Byzantine Text', '2024-08-01', BOTH, false),
  ebible('WEBC', 'eng-web-c', 'World English Bible (Catholic)', '2026-08-08', BOTH, false),
  ebible('WEBCL', 'eng-web', 'World English Bible Classic', '2026-08-08', BOTH, false),
  ebible('WEBBE', 'eng-webbe', 'World English Bible British Edition', '2026-08-08', BOTH, false),
  ebible('WEBU', 'engwebu', 'World English Bible Updated', '2026-08-08', BOTH, false),
  ebible('WEBPB', 'engwebpb', 'World English Bible British (Protestant)', '2026-08-08', PROTESTANT, false),
  ebible('WMB', 'engwmb', 'World Messianic Bible', '2026-08-08', PROTESTANT, false),
  ebible('WMBB', 'engwmbb', 'World Messianic Bible British Edition', '2026-08-08', PROTESTANT, false),
  ebible('OEBUS', 'engoebus', 'Open English Bible (U.S. spelling)', '2025-06-01', PROTESTANT, false,
    'Incomplete: 17 of 39 Old Testament books.'),
  ebible('OEBCW', 'engoebcw', 'Open English Bible (Commonwealth)', '2025-06-01', PROTESTANT, false,
    'Incomplete: 17 of 39 Old Testament books.'),
  ebible('JPS', 'engjps', 'JPS TaNaKH 1917', '2022-11-03', PROTESTANT, false,
    'Old Testament only.'),
  ebible('LEE', 'englee', 'Isaac Leeser Tanakh', '2022-11-03', PROTESTANT, false,
    'Old Testament only.'),
  ebible('BRENTON', 'eng-Brenton', 'Brenton Septuagint Translation', '2022-11-03', BOTH, false,
    'Septuagint, Old Testament only.'),
  ebible('LXX2012', 'eng-lxx2012', 'LXX2012 Septuagint (American English)', '2022-11-03', BOTH, false,
    'Septuagint, Old Testament only.'),
  ebible('LXX2012UK', 'eng-uk-lxx2012', 'LXX2012 Septuagint (British English)', '2022-11-03', BOTH, false,
    'Septuagint, Old Testament only.'),
  ebible('LXXUP', 'englxxup', 'Updated Brenton English Septuagint', '2024-08-01', BOTH, false,
    'Septuagint, Old Testament only.'),
  ebible('NOYES', 'engnoy', 'George Noyes Bible', '2022-11-03', PROTESTANT, false,
    'Partial: 22 of 39 Old Testament books.'),
  ebible('TNT', 'engtnt', 'Tyndale New Testament', '2022-11-03', PROTESTANT, false,
    'New Testament only.'),
  ebible('WYC', 'engWycliffe', 'Wycliffe Bible', '2022-11-03', PROTESTANT, false,
    'Partial: 9 books.'),
  ebible('ONK', 'engoke', 'Targum Onkelos Etheridge', '2022-11-03', PROTESTANT, false,
    'Partial: Pentateuch targum, 5 books.'),
];

/** The publisher's USFM archive for a source. */
export function archiveUrl(source: BibleSource): string {
  return `https://ebible.org/Scriptures/${source.ebibleId}_usfm.zip`;
}

/** The publisher's page describing the text and its licence. */
export function detailsUrl(source: BibleSource): string {
  return `https://ebible.org/Scriptures/details.php?id=${source.ebibleId}`;
}

export function findSource(code: string): BibleSource | undefined {
  const upper = code.trim().toUpperCase();
  return BIBLE_SOURCES.find((s) => s.code === upper || s.ebibleId.toUpperCase() === upper);
}
