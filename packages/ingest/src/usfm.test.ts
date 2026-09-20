import { describe, expect, it } from 'vitest';
import { extractStrongs, parseUsfm, stripMarkup } from './usfm.js';

/**
 * Every fixture here is a construct taken from the eBible.org archives, not
 * invented. Silent corruption in this parser would poison every verse in the
 * database, and a parser tested only against tidy input is untested.
 */

describe('stripMarkup', () => {
  it('unwraps word markup while keeping the word', () => {
    // BSB carries Strong's numbers inline on most words.
    const input = '\\w Paul|strong="G3972"\\w*, \\w a|strong="G1519"\\w* servant';
    expect(stripMarkup(input)).toBe('Paul, a servant');
  });

  it('removes footnotes along with their text', () => {
    // Leaving footnote text in would splice editorial comment into
    // Scripture, which AGENTS.md §2 forbids.
    const input = 'and God said\\f + \\fr 1.3 \\ft Or "let there be light"\\f* let there be light';
    expect(stripMarkup(input)).toBe('and God said let there be light');
  });

  it('removes cross-reference apparatus with its contents', () => {
    const input = 'In the beginning\\x - \\xo 1.1 \\xt John 1:1\\x* God created';
    expect(stripMarkup(input)).toBe('In the beginning God created');
  });

  it('keeps the text inside character markers', () => {
    // \add marks words supplied by the translator; they are part of the verse.
    expect(stripMarkup('the LORD \\add is\\add* my shepherd')).toBe('the LORD is my shepherd');
    expect(stripMarkup('\\nd LORD\\nd* of hosts')).toBe('LORD of hosts');
  });

  it('handles nested character markup', () => {
    const input = '\\add the \\nd LORD\\nd* said\\add*';
    expect(stripMarkup(input)).toBe('the LORD said');
  });

  it('collapses whitespace introduced by stripping', () => {
    expect(stripMarkup('a  \\add b\\add*   c')).toBe('a b c');
  });

  it('treats discretionary breaks and fixed spaces as spaces', () => {
    expect(stripMarkup('line one//line two')).toBe('line one line two');
    expect(stripMarkup('a~b')).toBe('a b');
  });

  it('drops standalone markers that carry no text', () => {
    expect(stripMarkup('\\p text after paragraph')).toBe('text after paragraph');
  });
});

describe('extractStrongs', () => {
  it('recovers lemma data that display text discards', () => {
    const input = '\\w Paul|strong="G3972"\\w*, \\w a|strong="G1519"\\w* servant';
    expect(extractStrongs(input)).toEqual([
      { word: 'Paul', strong: 'G3972' },
      { word: 'a', strong: 'G1519' },
    ]);
  });

  it('returns nothing for text without lemma data', () => {
    expect(extractStrongs('plain verse text')).toEqual([]);
  });
});

describe('parseUsfm', () => {
  const sample = [
    '\\id ROM - Berean Standard Bible',
    '\\h Romans',
    '\\toc1 Romans',
    '\\mt1 Romans',
    '\\c 8',
    '\\s1 Life in the Spirit',
    '\\p',
    '\\v 28 And we know that God works all things together for good.',
    '\\v 29 For those God foreknew He also predestined.',
    '\\c 9',
    '\\p',
    '\\v 1 I speak the truth in Christ.',
  ].join('\n');

  it('reads the book id and heading', () => {
    const book = parseUsfm(sample);
    expect(book.bookId).toBe('ROM');
    expect(book.heading).toBe('Romans');
  });

  it('assigns verses to the right chapters', () => {
    const book = parseUsfm(sample);
    expect(book.verses).toHaveLength(3);
    expect(book.verses[0]).toMatchObject({ chapter: 8, verse: 28 });
    expect(book.verses[2]).toMatchObject({ chapter: 9, verse: 1 });
  });

  it('keeps verse text intact', () => {
    const book = parseUsfm(sample);
    expect(book.verses[0]?.text).toBe(
      'And we know that God works all things together for good.',
    );
  });

  it('excludes section headings from verse text', () => {
    // \s1 is an editorial heading, not Scripture.
    const book = parseUsfm(sample);
    expect(book.verses[0]?.text).not.toContain('Life in the Spirit');
  });

  it('joins verse text that spans several lines', () => {
    const multiline = [
      '\\id GEN',
      '\\c 1',
      '\\v 1 In the beginning God created',
      'the heavens and the earth.',
    ].join('\n');

    expect(parseUsfm(multiline).verses[0]?.text).toBe(
      'In the beginning God created the heavens and the earth.',
    );
  });

  it('continues a verse across a paragraph marker', () => {
    const withParagraph = [
      '\\id PSA',
      '\\c 23',
      '\\v 1 The LORD is my shepherd;',
      '\\q2 I shall not want.',
    ].join('\n');

    expect(parseUsfm(withParagraph).verses[0]?.text).toBe(
      'The LORD is my shepherd; I shall not want.',
    );
  });

  it('records merged verse ranges', () => {
    // Some editions merge verses, e.g. \v 1-2 in certain Psalms.
    const merged = ['\\id PSA', '\\c 1', '\\v 1-2 Blessed is the man.'].join('\n');
    const verse = parseUsfm(merged).verses[0];

    expect(verse).toMatchObject({ verse: 1, verseEnd: 2 });
  });

  it('treats a single verse as a range of one', () => {
    const single = ['\\id PSA', '\\c 1', '\\v 3 He is like a tree.'].join('\n');
    expect(parseUsfm(single).verses[0]).toMatchObject({ verse: 3, verseEnd: 3 });
  });

  it('tolerates verse-number suffixes', () => {
    const suffixed = ['\\id JHN', '\\c 1', '\\v 1a In the beginning was the Word.'].join('\n');
    expect(parseUsfm(suffixed).verses[0]).toMatchObject({ verse: 1, verseEnd: 1 });
  });

  it('omits verses that are empty after stripping', () => {
    // An edition may mark a verse present but supply no text. Storing it
    // blank would make a missing verse indistinguishable from an empty one.
    const empty = ['\\id MRK', '\\c 16', '\\v 9', '\\v 10 And they went.'].join('\n');
    const verses = parseUsfm(empty).verses;

    expect(verses).toHaveLength(1);
    expect(verses[0]?.verse).toBe(10);
  });

  it('ignores verses appearing before any chapter marker', () => {
    const noChapter = ['\\id FRT', '\\v 1 Front matter text.'].join('\n');
    expect(parseUsfm(noChapter).verses).toHaveLength(0);
  });

  it('returns an empty book rather than throwing on peripheral files', () => {
    const frontMatter = ['\\id FRT - Front Matter', '\\h Introduction', '\\p Some preface.'].join(
      '\n',
    );
    const book = parseUsfm(frontMatter);

    expect(book.bookId).toBe('FRT');
    expect(book.verses).toHaveLength(0);
  });

  it('handles CRLF line endings', () => {
    const crlf = '\\id ROM\r\n\\c 1\r\n\\v 1 Paul, a servant.\r\n';
    expect(parseUsfm(crlf).verses[0]?.text).toBe('Paul, a servant.');
  });
});
