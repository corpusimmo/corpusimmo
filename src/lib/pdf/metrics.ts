/**
 * Adobe base-14 metrics for Helvetica, Helvetica-Bold and Helvetica-Oblique.
 *
 * Widths are in 1/1000 em. They are needed for three things the layout cannot
 * fake: wrapping a paragraph, right-aligning a price column, and centring a
 * title.
 *
 * Accented glyphs reuse their base-letter width — that is exact in Helvetica for
 * the composed Latin-1 letters (é, à, ç… are the base glyph plus a zero-width
 * accent). The handful of glyphs where it is not exact (í, ï) are listed
 * explicitly; anything still approximate only shifts a wrap point by a fraction
 * of a character.
 */

import { toWinAnsiText, winAnsiByte } from "./winansi";

export type PdfFont = "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique";

// prettier-ignore
const HELVETICA_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

// prettier-ignore
const HELVETICA_BOLD_ASCII = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Non-ASCII WinAnsi bytes whose width is not simply the base letter's. */
const EXPLICIT: Readonly<Record<number, readonly [number, number]>> = {
  0x80: [556, 556], // Euro
  0x85: [1000, 1000], // ellipsis
  0x8c: [1000, 1000], // OE
  0x91: [222, 278], // quoteleft
  0x92: [222, 278], // quoteright
  0x93: [333, 500], // quotedblleft
  0x94: [333, 500], // quotedblright
  0x95: [350, 350], // bullet
  0x96: [556, 556], // endash
  0x97: [1000, 1000], // emdash
  0x9c: [944, 944], // oe
  0xa0: [278, 278], // nbsp
  0xa9: [737, 737], // ©
  0xab: [556, 556], // «
  0xb0: [400, 400], // °
  0xb2: [333, 333], // ²
  0xb3: [333, 333], // ³
  0xbb: [556, 556], // »
  0xc6: [1000, 1000], // Æ
  0xdf: [556, 611], // ß
  0xe6: [889, 889], // æ
  0xec: [278, 278], // ì
  0xed: [278, 278], // í
  0xee: [278, 278], // î
  0xef: [278, 278], // ï
  0xf7: [584, 584], // ÷
};

/** WinAnsi byte → the ASCII character whose width it borrows. */
function baseLetter(byte: number): string | undefined {
  if (byte >= 0xc0 && byte <= 0xc5) return "A";
  if (byte === 0xc7) return "C";
  if (byte >= 0xc8 && byte <= 0xcb) return "E";
  if (byte >= 0xcc && byte <= 0xcf) return "I";
  if (byte === 0xd0) return "D";
  if (byte === 0xd1) return "N";
  if ((byte >= 0xd2 && byte <= 0xd6) || byte === 0xd8) return "O";
  if (byte >= 0xd9 && byte <= 0xdc) return "U";
  if (byte === 0xdd || byte === 0x9f) return "Y";
  if (byte === 0xde) return "P";
  if (byte >= 0xe0 && byte <= 0xe5) return "a";
  if (byte === 0xe7) return "c";
  if (byte >= 0xe8 && byte <= 0xeb) return "e";
  if (byte === 0xf1) return "n";
  if ((byte >= 0xf2 && byte <= 0xf6) || byte === 0xf8) return "o";
  if (byte >= 0xf9 && byte <= 0xfc) return "u";
  if (byte === 0xfd || byte === 0xff) return "y";
  if (byte === 0xfe) return "p";
  return undefined;
}

function asciiWidth(char: string, bold: boolean): number {
  const code = char.charCodeAt(0);
  const table = bold ? HELVETICA_BOLD_ASCII : HELVETICA_ASCII;
  const index = code - 32;
  return table[index] ?? (bold ? 556 : 556);
}

function glyphWidth(byte: number, bold: boolean): number {
  if (byte >= 32 && byte <= 126) return asciiWidth(String.fromCharCode(byte), bold);
  const explicit = EXPLICIT[byte];
  if (explicit) return bold ? explicit[1] : explicit[0];
  const proxy = baseLetter(byte);
  if (proxy) return asciiWidth(proxy, bold);
  return bold ? 556 : 556;
}

/**
 * Extra advance inserted after `€`, in 1/1000 em.
 *
 * The base-14 `Helvetica` is not embedded: every viewer substitutes its own
 * face. In several of them (CoreGraphics/Preview in particular) the euro glyph
 * is drawn wider than the 556-unit advance Adobe's metrics give it, so it visibly
 * collides with whatever follows — `4 598 €/m²` renders with the slash cutting
 * through the €. A small explicit kern fixes it everywhere and is invisible when
 * the substitute font is well-behaved.
 */
export const EURO_KERN = 110;

export interface KernRun {
  text: string;
  /** Extra advance to insert AFTER this run, in 1/1000 em. */
  kernAfter: number;
}

/** Splits a folded string into runs separated by explicit kerning adjustments. */
export function kernRuns(folded: string): KernRun[] {
  const runs: KernRun[] = [];
  const chars = [...folded];
  let current = "";

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    if (char === undefined) continue;
    current += char;
    if (char === "€" && i < chars.length - 1) {
      runs.push({ text: current, kernAfter: EURO_KERN });
      current = "";
    }
  }
  if (current) runs.push({ text: current, kernAfter: 0 });
  return runs;
}

/** Rendered width of `text` in points, kerning included. */
export function measureText(text: string, font: PdfFont, size: number): number {
  const bold = font === "Helvetica-Bold";
  const folded = toWinAnsiText(text);
  let total = 0;
  for (const char of folded) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    total += glyphWidth(winAnsiByte(cp), bold);
  }
  for (const run of kernRuns(folded)) total += run.kernAfter;
  return (total * size) / 1000;
}

/**
 * Greedy word wrap. A single word longer than `maxWidth` (a long address, a URL)
 * is hard-split rather than allowed to bleed out of the column.
 */
export function wrapText(text: string, font: PdfFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of toWinAnsiText(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureText(candidate, font, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);

      if (measureText(word, font, size) <= maxWidth) {
        current = word;
        continue;
      }
      // Hard split.
      let chunk = "";
      for (const char of word) {
        if (measureText(chunk + char, font, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }

  return lines;
}

/** Truncates with an ellipsis so a table cell never overflows its column. */
export function truncateToWidth(
  text: string,
  font: PdfFont,
  size: number,
  maxWidth: number,
): string {
  const folded = toWinAnsiText(text);
  if (measureText(folded, font, size) <= maxWidth) return folded;
  let out = "";
  for (const char of folded) {
    if (measureText(`${out}${char}…`, font, size) > maxWidth) break;
    out += char;
  }
  return `${out.trimEnd()}…`;
}
