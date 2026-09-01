/**
 * WinAnsiEncoding (CP1252) support for the standard PDF fonts.
 *
 * THE ACCENT PROBLEM: a PDF literal string is a byte string. With the base-14
 * Helvetica and `/Encoding /WinAnsiEncoding`, byte 0xE9 renders `é`. If we naively
 * dumped UTF-8 bytes, `é` (0xC3 0xA9) would render as `Ã©` — the classic broken
 * French PDF. Everything below exists to make that impossible.
 *
 * Two traps beyond plain Latin-1:
 *  1. `Intl.NumberFormat("fr-FR")` groups thousands with U+202F (narrow no-break
 *     space) and prefixes `€` with U+00A0. U+202F has NO WinAnsi code point, so
 *     it is folded to a plain space before encoding. Without this, every price in
 *     the document would show a `?`.
 *  2. `€`, curly quotes, dashes and the ellipsis live in 0x80–0x9F, a range where
 *     WinAnsi and Latin-1 disagree. They get an explicit table.
 */

/** Unicode code point → WinAnsi byte, for the 0x80–0x9F block. */
const HIGH_BLOCK: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80], // €
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85], // …
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c], // Œ
  [0x017d, 0x8e],
  [0x2018, 0x91], // '
  [0x2019, 0x92], // '
  [0x201c, 0x93], // "
  [0x201d, 0x94], // "
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c], // œ
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

/** Whitespace variants with no WinAnsi code point, folded to a plain space. */
const SPACE_LIKE = new Set([0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000]);

const REPLACEMENT = 0x3f; // '?'

/**
 * Folds a JS string onto the WinAnsi repertoire, returning the CHARACTERS (not
 * bytes) that will survive encoding. Layout code measures this form so wrapping
 * matches what is finally drawn.
 */
export function toWinAnsiText(input: string): string {
  let out = "";
  for (const char of input) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 0x0a || cp === 0x0d) {
      out += "\n";
      continue;
    }
    if (cp < 0x20) continue; // control characters: dropped, never rendered
    if (SPACE_LIKE.has(cp)) {
      out += " ";
      continue;
    }
    if (cp <= 0x7e) {
      out += char;
      continue;
    }
    if (HIGH_BLOCK.has(cp)) {
      out += char;
      continue;
    }
    if (cp >= 0xa0 && cp <= 0xff) {
      out += char;
      continue;
    }
    out += "?";
  }
  return out;
}

/** Code point → WinAnsi byte. Assumes `toWinAnsiText` already ran. */
export function winAnsiByte(codePoint: number): number {
  if (codePoint <= 0x7e) return codePoint;
  const high = HIGH_BLOCK.get(codePoint);
  if (high !== undefined) return high;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint;
  return REPLACEMENT;
}

/** Encodes an already-folded string to WinAnsi bytes. */
export function encodeWinAnsi(input: string): Uint8Array {
  const folded = toWinAnsiText(input);
  const bytes = new Uint8Array(folded.length);
  let i = 0;
  for (const char of folded) {
    const cp = char.codePointAt(0);
    bytes[i] = cp === undefined ? REPLACEMENT : winAnsiByte(cp);
    i += 1;
  }
  return bytes.subarray(0, i);
}
