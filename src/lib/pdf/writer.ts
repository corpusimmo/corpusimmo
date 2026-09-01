/**
 * A very small PDF writer — no dependency.
 *
 * DECISION (and why no library): the consumer report is deliberately austere —
 * one or two pages of text, a few rules, one table, no image, no embedded font.
 * `pdfkit` drags in a stream/font stack that Next has to bundle for the server
 * runtime; `@react-pdf/renderer` pulls a whole reconciler; `pdf-lib` is the
 * lightest of the three and still ~350 kB for features we do not use. Writing
 * the PDF by hand is ~300 lines, has zero build risk on Vercel, and keeps the
 * base-14 Helvetica path — which is exactly what a sober document needs.
 * The moment we need embedded fonts, vector charts or images, this decision
 * should be revisited in favour of `pdf-lib`.
 *
 * Coordinates exposed here are TOP-DOWN (y = 0 at the top of the page), because
 * layout code reads top to bottom; the conversion to PDF's bottom-left origin
 * happens in one place.
 */

import { kernRuns, measureText, truncateToWidth, wrapText, type PdfFont } from "./metrics";
import { encodeWinAnsi, toWinAnsiText } from "./winansi";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const A4 = { width: 595.28, height: 841.89 } as const;

const FONT_RESOURCE: Record<PdfFont, string> = {
  Helvetica: "F1",
  "Helvetica-Bold": "F2",
  "Helvetica-Oblique": "F3",
};

export interface TextOptions {
  font?: PdfFont;
  size?: number;
  color?: Rgb;
  align?: "left" | "right" | "center";
  /** Right edge used by `align: "right"` / `"center"`. */
  width?: number;
}

function fmt(n: number): string {
  // 2 decimals is below the precision any renderer resolves at 72 dpi and keeps
  // the content stream small.
  return (Math.round(n * 100) / 100).toString();
}

function colorOp(c: Rgb, stroke: boolean): string {
  return `${fmt(c.r)} ${fmt(c.g)} ${fmt(c.b)} ${stroke ? "RG" : "rg"}`;
}

/** Escapes a PDF literal string. */
function literal(text: string): string {
  return toWinAnsiText(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\n/g, " ");
}

/**
 * Builds the text-showing operator. `Tj` for a plain run, `TJ` when a kern has
 * to be inserted (TJ numbers are SUBTRACTED from the advance, hence the sign).
 */
function showOperator(text: string): string {
  const runs = kernRuns(toWinAnsiText(text));
  const first = runs[0];
  if (runs.length === 1 && first && first.kernAfter === 0) {
    return `(${literal(first.text)}) Tj`;
  }
  const parts = runs.map((run) =>
    run.kernAfter === 0 ? `(${literal(run.text)})` : `(${literal(run.text)}) ${-run.kernAfter}`,
  );
  return `[${parts.join(" ")}] TJ`;
}

interface Page {
  ops: string[];
}

export interface PdfWriterOptions {
  title?: string;
  author?: string;
  margin?: number;
}

export class PdfWriter {
  private readonly pages: Page[] = [];
  private current: Page | null = null;
  private readonly options: Required<Omit<PdfWriterOptions, "title" | "author">> &
    Pick<PdfWriterOptions, "title" | "author">;

  /** Top-down cursor, in points from the top of the page. */
  y = 0;

  constructor(options: PdfWriterOptions = {}) {
    this.options = {
      margin: options.margin ?? 48,
      title: options.title,
      author: options.author,
    };
    this.addPage();
  }

  get margin(): number {
    return this.options.margin;
  }

  get contentWidth(): number {
    return A4.width - this.margin * 2;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    const page: Page = { ops: [] };
    this.pages.push(page);
    this.current = page;
    this.y = this.margin;
  }

  /** Starts a new page when `height` would not fit above the bottom margin. */
  ensureSpace(height: number): void {
    if (this.y + height > A4.height - this.margin) this.addPage();
  }

  private push(op: string): void {
    // `current` is set by the constructor and by `addPage`; never null in practice.
    (this.current ?? this.pages[this.pages.length - 1])?.ops.push(op);
  }

  // --- primitives ------------------------------------------------------------

  fillRect(x: number, yTop: number, width: number, height: number, color: Rgb): void {
    const y = A4.height - yTop - height;
    this.push(`q ${colorOp(color, false)} ${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)} re f Q`);
  }

  line(x1: number, yTop1: number, x2: number, yTop2: number, color: Rgb, width = 0.6): void {
    this.push(
      `q ${colorOp(color, true)} ${fmt(width)} w ${fmt(x1)} ${fmt(A4.height - yTop1)} m ${fmt(x2)} ${fmt(A4.height - yTop2)} l S Q`,
    );
  }

  /** Draws one line of text whose BASELINE sits `yTop` points below the top. */
  text(value: string, x: number, yTop: number, options: TextOptions = {}): void {
    const font = options.font ?? "Helvetica";
    const size = options.size ?? 10;
    const color = options.color ?? { r: 0, g: 0, b: 0 };
    if (!literal(value)) return;

    let drawX = x;
    if (options.align && options.align !== "left" && options.width !== undefined) {
      const w = measureText(value, font, size);
      drawX = options.align === "right" ? x + options.width - w : x + (options.width - w) / 2;
    }

    this.push(
      `BT ${colorOp(color, false)} /${FONT_RESOURCE[font]} ${fmt(size)} Tf ` +
        `1 0 0 1 ${fmt(drawX)} ${fmt(A4.height - yTop)} Tm ${showOperator(value)} ET`,
    );
  }

  /**
   * Wraps and draws a paragraph starting at the cursor, paginating as needed.
   * Returns the cursor position after the paragraph.
   */
  paragraph(
    value: string,
    options: TextOptions & { lineHeight?: number; x?: number; width?: number } = {},
  ): number {
    const font = options.font ?? "Helvetica";
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size * 1.45;
    const x = options.x ?? this.margin;
    const width = options.width ?? this.contentWidth;

    for (const line of wrapText(value, font, size, width)) {
      this.ensureSpace(lineHeight);
      this.y += lineHeight;
      this.text(line, x, this.y, { font, size, color: options.color });
    }
    return this.y;
  }

  /**
   * Runs `draw` once per page, with that page as the target. Used for footers,
   * which can only be numbered once the total page count is known.
   */
  onEachPage(draw: (pageIndex: number, pageCount: number) => void): void {
    const saved = this.current;
    const savedY = this.y;
    this.pages.forEach((page, index) => {
      this.current = page;
      draw(index, this.pages.length);
    });
    this.current = saved;
    this.y = savedY;
  }

  measure(value: string, font: PdfFont, size: number): number {
    return measureText(value, font, size);
  }

  truncate(value: string, font: PdfFont, size: number, maxWidth: number): string {
    return truncateToWidth(value, font, size, maxWidth);
  }

  // --- serialisation ---------------------------------------------------------

  build(): Uint8Array {
    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let length = 0;

    const write = (value: string | Uint8Array): void => {
      const bytes = typeof value === "string" ? encodeWinAnsi(value) : value;
      chunks.push(bytes);
      length += bytes.length;
    };

    // Object numbering: 1 catalog, 2 pages, 3-5 fonts, 6 info, then page/content pairs.
    const FIRST_PAGE_OBJ = 7;
    const pageObjectIds = this.pages.map((_, i) => FIRST_PAGE_OBJ + i * 2);
    const totalObjects = 6 + this.pages.length * 2;

    const beginObject = (id: number): void => {
      offsets[id] = length;
      write(`${id} 0 obj\n`);
    };

    // Binary comment on line 2: tells transfer tools the file is not plain text.
    write("%PDF-1.4\n%âãÏÓ\n");

    beginObject(1);
    write("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    beginObject(2);
    write(
      `<< /Type /Pages /Count ${this.pages.length} /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] >>\nendobj\n`,
    );

    const fonts: [number, string][] = [
      [3, "Helvetica"],
      [4, "Helvetica-Bold"],
      [5, "Helvetica-Oblique"],
    ];
    for (const [id, baseFont] of fonts) {
      beginObject(id);
      write(
        `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>\nendobj\n`,
      );
    }

    beginObject(6);
    write(
      `<< /Producer (CorpusImmo) /Creator (CorpusImmo)${
        this.options.title ? ` /Title (${literal(this.options.title)})` : ""
      }${this.options.author ? ` /Author (${literal(this.options.author)})` : ""} /CreationDate (${pdfDate(new Date())}) >>\nendobj\n`,
    );

    this.pages.forEach((page, index) => {
      const pageId = FIRST_PAGE_OBJ + index * 2;
      const contentId = pageId + 1;

      beginObject(pageId);
      write(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(A4.width)} ${fmt(A4.height)}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>\nendobj\n`,
      );

      const stream = encodeWinAnsi(page.ops.join("\n"));
      beginObject(contentId);
      write(`<< /Length ${stream.length} >>\nstream\n`);
      write(stream);
      write("\nendstream\nendobj\n");
    });

    const xrefOffset = length;
    write(`xref\n0 ${totalObjects + 1}\n`);
    write("0000000000 65535 f \n");
    for (let id = 1; id <= totalObjects; id += 1) {
      const offset = offsets[id] ?? 0;
      write(`${offset.toString().padStart(10, "0")} 00000 n \n`);
    }
    write(
      `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    );

    const output = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      output.set(chunk, cursor);
      cursor += chunk.length;
    }
    return output;
  }
}

function pdfDate(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}
