import { describe, expect, it } from "vitest";

import type { DvfTransaction } from "@/types/dvf";
import type { Comparable, ValuationResult } from "@/types/valuation";

import { estimationPdfFilename, renderEstimationPdf } from "./estimation-pdf";
import { measureText, wrapText } from "./metrics";
import { encodeWinAnsi, toWinAnsiText } from "./winansi";

function makeTransaction(index: number): DvfTransaction {
  return {
    id: `geodvf:2024-${1000 + index}`,
    date: `2024-0${(index % 9) + 1}-15`,
    year: 2024,
    nature: "sale",
    price: 320_000 + index * 15_000,
    propertyType: "apartment",
    propertyTypeLabel: "Appartement",
    builtArea: 68 + index,
    rooms: 3,
    addressLabel: `${index + 2} rue de l'Église-Saint-Léonard`,
    postcode: "44000",
    city: "Nantes",
    cityCode: "44109",
    departmentCode: "44",
    coordinates: { lat: 47.2184 + index * 0.001, lng: -1.5536 },
    pricePerSqm: Math.round((320_000 + index * 15_000) / (68 + index)),
    isMultiLot: false,
    source: "geodvf",
  };
}

function makeComparable(index: number): Comparable {
  return {
    transaction: makeTransaction(index),
    distance: 120 + index * 90,
    ageMonths: 6 + index,
    scores: { distance: 0.9, recency: 0.8, area: 0.85, type: 1 },
    weight: 0.2,
    excluded: false,
  };
}

function makeValuation(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    id: "5f2b6d0e-9c3a-4c1e-8b7a-1d2e3f4a5b6c",
    method: "comparison",
    status: "computed",
    createdAt: "2026-06-01T09:30:00.000Z",
    subject: {
      type: "apartment",
      address: {
        id: "44109_1234_00008",
        label: "8 Rue de la Paix, 44000 Nantes",
        kind: "housenumber",
        houseNumber: "8",
        street: "Rue de la Paix",
        postcode: "44000",
        city: "Nantes",
        cityCode: "44109",
        departmentCode: "44",
        coordinates: { lat: 47.2184, lng: -1.5536 },
        score: 0.97,
      },
      features: {
        livingArea: 72,
        rooms: 3,
        bedrooms: 2,
        floor: 2,
        hasElevator: true,
        condition: "good",
        constructionYear: 1974,
        outdoor: "balcony",
        outdoorArea: 6,
      },
    },
    intent: "selling_under_3m",
    value: { low: 298_000, central: 331_000, high: 364_000 },
    pricePerSqm: 4598,
    medianPricePerSqm: 4520,
    averagePricePerSqm: 4610,
    confidence: {
      score: 74,
      level: "moderate",
      factors: [
        { label: "12 ventes comparables à moins de 800 m", impact: "positive" },
        { label: "Dispersion des prix au m² modérée", impact: "neutral" },
        { label: "Aucune vente de moins de 6 mois", impact: "negative" },
      ],
    },
    comparables: [0, 1, 2, 3, 4, 5, 6].map(makeComparable),
    diagnostics: {
      radiusUsed: 800,
      candidatesFound: 143,
      rejected: [
        { reason: "Surface trop éloignée", count: 61 },
        { reason: "Vente multi-lots", count: 12 },
      ],
      retained: 12,
      dispersion: 0.18,
      yearRange: [2022, 2024],
    },
    ...overrides,
  };
}

describe("renderEstimationPdf", () => {
  it("produit un buffer PDF non vide commençant par %PDF-", async () => {
    const bytes = await renderEstimationPdf(makeValuation());

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(2000);

    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
    expect(header).toBe("%PDF-1.4");

    const tail = new TextDecoder("latin1").decode(bytes.subarray(bytes.length - 20));
    expect(tail).toContain("%%EOF");
  });

  it("contient la table xref et le catalogue", async () => {
    const bytes = await renderEstimationPdf(makeValuation());
    const content = new TextDecoder("latin1").decode(bytes);
    expect(content).toContain("/Type /Catalog");
    expect(content).toContain("/Type /Pages");
    expect(content).toContain("xref");
    expect(content).toContain("startxref");
    expect(content).toContain("/Encoding /WinAnsiEncoding");
  });

  it("encode les accents français en WinAnsi, pas en UTF-8", async () => {
    const bytes = await renderEstimationPdf(makeValuation());
    const content = new TextDecoder("latin1").decode(bytes);

    // « Méthodologie » doit apparaître avec 0xE9 pour le « é ».
    expect(content).toContain("Méthodologie");
    // La double séquence UTF-8 mal décodée (Ã©) est le symptôme de l'échec.
    expect(content).not.toContain("Ã©");
  });

  it("reste valide quand le moteur n'a pas conclu", async () => {
    const bytes = await renderEstimationPdf(
      makeValuation({
        status: "failed",
        value: undefined,
        pricePerSqm: undefined,
        medianPricePerSqm: undefined,
        comparables: [],
        confidence: { score: 12, level: "low", factors: [] },
        diagnostics: {
          radiusUsed: 5000,
          candidatesFound: 4,
          rejected: [{ reason: "Trop peu de comparables", count: 4 }],
          retained: 0,
          failureReason: "Moins de 5 ventes comparables exploitables dans un rayon de 5 km.",
        },
      }),
    );
    const header = new TextDecoder("latin1").decode(bytes.subarray(0, 5));
    expect(header).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
  });

  it("les offsets xref pointent bien sur des objets", async () => {
    const bytes = await renderEstimationPdf(makeValuation());
    const content = new TextDecoder("latin1").decode(bytes);
    const xrefIndex = content.lastIndexOf("\nxref\n");
    expect(xrefIndex).toBeGreaterThan(0);

    const entries = content
      .slice(xrefIndex)
      .split("\n")
      .filter((line) => / 00000 n $/.test(line));
    expect(entries.length).toBeGreaterThanOrEqual(6);

    for (const entry of entries) {
      const offset = Number.parseInt(entry.slice(0, 10), 10);
      expect(offset).toBeGreaterThan(0);
      expect(content.slice(offset)).toMatch(/^\d+ 0 obj/);
    }
  });
});

describe("estimationPdfFilename", () => {
  it("produit un nom ASCII, sans accent ni espace", () => {
    const name = estimationPdfFilename(makeValuation());
    expect(name).toBe("estimation-corpusimmo-nantes-5f2b6d0e.pdf");
    expect(name).toMatch(/^[a-z0-9.-]+$/);
  });
});

describe("encodage WinAnsi", () => {
  it("mappe é sur 0xE9 et € sur 0x80", () => {
    const bytes = encodeWinAnsi("é€");
    expect(Array.from(bytes)).toEqual([0xe9, 0x80]);
  });

  it("replie l'espace fine insécable de Intl sur une espace ordinaire", () => {
    // `Intl.NumberFormat("fr-FR")` sépare les milliers avec U+202F : sans
    // repliage, chaque prix afficherait un « ? » dans le PDF.
    const formatted = new Intl.NumberFormat("fr-FR").format(348000);
    const folded = toWinAnsiText(formatted);
    expect(folded).not.toContain("?");
    expect(folded).toMatch(/^348.000$/);
  });

  it("remplace un caractère hors répertoire par ?", () => {
    expect(toWinAnsiText("日本")).toBe("??");
  });
});

describe("métriques Helvetica", () => {
  it("mesure une chaîne ASCII conformément aux largeurs Adobe", () => {
    // 'A' = 667/1000 em, 'V' = 667 → 1334/1000 * 12 = 16.008
    expect(measureText("AV", "Helvetica", 12)).toBeCloseTo(16.008, 3);
  });

  it("donne à un caractère accentué la largeur de sa lettre de base", () => {
    expect(measureText("é", "Helvetica", 10)).toBeCloseTo(measureText("e", "Helvetica", 10), 6);
  });

  it("découpe un paragraphe sans dépasser la largeur demandée", () => {
    const text =
      "Cette estimation est produite automatiquement à partir des Demandes de Valeurs Foncières.";
    const lines = wrapText(text, "Helvetica", 10, 180);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, "Helvetica", 10)).toBeLessThanOrEqual(180);
    }
  });

  it("coupe de force un mot plus long que la colonne", () => {
    const lines = wrapText("A".repeat(200), "Helvetica", 10, 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, "Helvetica", 10)).toBeLessThanOrEqual(60);
    }
  });
});
