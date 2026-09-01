/**
 * Minimal, allocation-conscious RFC 4180 CSV reader.
 *
 * We parse multi-megabyte files on a serverless request path, so no regex
 * splitting and no dependency: a single forward pass over the string.
 * Handles quoted fields, escaped quotes (`""`), embedded separators and
 * newlines, CRLF, and a trailing newline. Ragged rows are kept as-is — the
 * DVF normaliser decides whether a short row is fatal.
 */

export interface CsvTable {
  header: string[];
  rows: string[][];
}

export function parseCsv(input: string, separator = ","): CsvTable {
  const rows = parseCsvRows(input, separator);
  const [header, ...body] = rows;
  return { header: header ?? [], rows: body };
}

export function parseCsvRows(input: string, separator = ","): string[][] {
  const rows: string[][] = [];
  if (input.length === 0) return rows;

  // A BOM would poison the first header cell (`﻿id_mutation`).
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = (): void => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };

  const pushRow = (): void => {
    pushField();
    // Skip the phantom row produced by a trailing newline.
    if (row.length > 1 || (row[0] ?? "").length > 0) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (char === separator) {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushRow();
      continue;
    }

    if (char === "\r") {
      // Lone \r is treated as a line break too; \r\n consumes both.
      if (text[i + 1] === "\n") i += 1;
      pushRow();
      continue;
    }

    field += char;
    fieldStarted = true;
  }

  // Last line without a terminator.
  if (field.length > 0 || row.length > 0) pushRow();

  return rows;
}

/**
 * Index of each column by name, so the normaliser never hardcodes positions.
 * Etalab has reordered columns between millésimes before.
 */
export function columnIndex(header: readonly string[]): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    const key = name.trim();
    if (key.length > 0 && !index.has(key)) index.set(key, i);
  });
  return index;
}
