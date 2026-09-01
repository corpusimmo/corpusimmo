/**
 * Le catalogue déclare des chemins et des dimensions. Ce test vérifie que les
 * fichiers existent vraiment et que les dimensions déclarées sont celles des
 * fichiers : une capture renommée ou recompressée sans mise à jour du catalogue
 * casserait la page en silence, ou la ferait sauter au chargement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getToolPreviews, MAX_PREVIEW_TALLNESS } from "./tool-previews";
import { toolCatalogue } from "./tools-catalogue";

const PUBLIC_DIR = join(process.cwd(), "public");

/** Dimensions lues dans le premier marqueur SOF du JPEG. */
function jpegSize(path: string): { width: number; height: number } {
  const data = readFileSync(path);
  let i = 2;
  while (i < data.length) {
    if (data[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = data[i + 1];
    if (marker === undefined) break;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + data.readUInt16BE(i + 2);
  }
  throw new Error(`Pas de marqueur SOF dans ${path}`);
}

describe("les aperçus des classeurs", () => {
  const shots = toolCatalogue.flatMap((tool) =>
    getToolPreviews(tool.id).map((shot) => ({ tool: tool.id, ...shot })),
  );

  it("couvre les dix outils du catalogue", () => {
    for (const tool of toolCatalogue) {
      expect(getToolPreviews(tool.id).length, `aucun aperçu pour ${tool.id}`).toBeGreaterThan(0);
    }
  });

  it.each(shots.map((shot) => [shot.src, shot] as const))(
    "%s existe avec les dimensions déclarées",
    (_src, shot) => {
      const measured = jpegSize(join(PUBLIC_DIR, shot.src));
      expect(measured).toEqual({ width: shot.width, height: shot.height });
    },
  );

  it("nomme chaque capture d'après l'outil et son rang d'onglet", () => {
    for (const tool of toolCatalogue) {
      getToolPreviews(tool.id).forEach((shot, index) => {
        expect(shot.src).toBe(`/outils/apercus/${tool.id}-${index + 1}.jpg`);
        expect(shot.label.trim()).not.toBe("");
      });
    }
  });

  it("garde un garde-fou de hauteur crédible", () => {
    // Sous 1, une capture plus large que haute serait rognée : absurde.
    expect(MAX_PREVIEW_TALLNESS).toBeGreaterThan(1);
    expect(MAX_PREVIEW_TALLNESS).toBeLessThan(3);
  });
});
