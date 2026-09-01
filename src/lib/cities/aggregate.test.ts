/**
 * Les tests du calcul, sur des lots fabriqués.
 *
 * Ce qui est vérifié ici est ce qui, faux, produirait un chiffre faux à
 * l'écran sans lever la moindre erreur : la sélection des mutations, l'écart
 * entre l'effectif retenu et l'effectif total, et la détection d'un millésime
 * incomplet.
 */

import { describe, expect, it } from "vitest";

import { makeTransaction } from "@/lib/valuation/fixtures";
import type { DvfTransaction } from "@/types/dvf";

import {
  arrondissementLabel,
  buildFigure,
  buildHistogram,
  buildSectors,
  buildVolumeByYear,
  buildYearFigures,
  detectPartialYears,
  isCityDwellingSale,
  postcodeLabel,
  usableUnitPrice,
} from "./aggregate";

function flat(overrides: Partial<DvfTransaction> = {}): DvfTransaction {
  return makeTransaction({ propertyType: "apartment", ...overrides });
}

describe("sélection des mutations", () => {
  it("ne retient que les ventes de gré à gré portant sur un logement", () => {
    expect(isCityDwellingSale(flat())).toBe(true);
    expect(isCityDwellingSale(flat({ nature: "sale_off_plan" }))).toBe(false);
    expect(isCityDwellingSale(flat({ nature: "auction" }))).toBe(false);
    expect(isCityDwellingSale(flat({ nature: "exchange" }))).toBe(false);
    expect(isCityDwellingSale(flat({ isMultiLot: true }))).toBe(false);
    expect(isCityDwellingSale(flat({ propertyType: "dependency" }))).toBe(false);
    expect(isCityDwellingSale(flat({ propertyType: "land" }))).toBe(false);
  });

  it("écarte un prix au m² hors des garde-fous du moteur d'estimation", () => {
    // 1 000 000 € pour 5 m² : accident d'encodage typique de DVF.
    expect(usableUnitPrice(flat({ price: 1_000_000, builtArea: 5, pricePerSqm: 200_000 }))).toBe(
      undefined,
    );
    expect(usableUnitPrice(flat({ pricePerSqm: 100 }))).toBe(undefined);
    expect(usableUnitPrice(flat({ pricePerSqm: 4200 }))).toBe(4200);
    expect(usableUnitPrice(flat({ pricePerSqm: undefined, builtArea: undefined }))).toBe(
      undefined,
    );
  });
});

describe("buildFigure", () => {
  it("compte séparément les ventes retenues et les ventes enregistrées", () => {
    const rows = [
      ...Array.from({ length: 40 }, (_, i) => flat({ pricePerSqm: 3000 + i * 10 })),
      // Multi-lot : c'est une vente, son prix au m² n'est pas exploitable.
      flat({ isMultiLot: true, pricePerSqm: 9000 }),
      // Prix au m² aberrant : compté dans le total, écarté du calcul.
      flat({ pricePerSqm: 90 }),
      // Adjudication : ce n'est pas une vente de gré à gré, donc rien du tout.
      flat({ nature: "auction" }),
    ];

    const figure = buildFigure(rows, "apartment");
    expect(figure.total).toBe(42);
    expect(figure.sample).toBe(40);
    expect(figure.median).toBeDefined();
  });

  it("ne publie aucune valeur monétaire quand aucun prix au m² n'est exploitable", () => {
    const rows = [flat({ pricePerSqm: undefined, builtArea: undefined })];
    const figure = buildFigure(rows, "apartment");
    expect(figure.sample).toBe(0);
    expect(figure.median).toBeUndefined();
    expect(figure.q1).toBeUndefined();
    expect(figure.histogram).toBeUndefined();
  });

  it("ordonne les quantiles et arrondit à la dizaine d'euros", () => {
    const rows = Array.from({ length: 200 }, (_, i) => flat({ pricePerSqm: 1000 + i * 17 }));
    const figure = buildFigure(rows, "apartment");
    expect(figure.d1).toBeLessThan(figure.q1 ?? 0);
    expect(figure.q1).toBeLessThan(figure.median ?? 0);
    expect(figure.median).toBeLessThan(figure.q3 ?? 0);
    expect(figure.q3).toBeLessThan(figure.d9 ?? 0);
    expect((figure.median ?? 0) % 10).toBe(0);
  });

  it("sépare les types de bien", () => {
    const rows = [
      ...Array.from({ length: 30 }, () => flat({ pricePerSqm: 3000 })),
      ...Array.from({ length: 10 }, () =>
        makeTransaction({ propertyType: "house", pricePerSqm: 2000 }),
      ),
    ];
    expect(buildFigure(rows, "apartment").sample).toBe(30);
    expect(buildFigure(rows, "house").sample).toBe(10);
  });
});

describe("buildHistogram", () => {
  it("borne les tranches aux déciles et compte ce qui en sort", () => {
    const values = [...Array.from({ length: 100 }, (_, i) => 1000 + i * 10)];
    const histogram = buildHistogram(values);
    expect(histogram).toBeDefined();
    if (!histogram) return;

    expect(histogram.bins).toHaveLength(8);
    // Rien n'est perdu : tout est soit dans une tranche, soit compté hors cadre.
    const inside = histogram.bins.reduce((sum, bin) => sum + bin.count, 0);
    expect(inside + histogram.below + histogram.above).toBe(values.length);
    expect(histogram.below).toBeGreaterThan(0);
    expect(histogram.above).toBeGreaterThan(0);
  });

  it("refuse de dessiner un histogramme sous dix valeurs", () => {
    expect(buildHistogram([1000, 2000, 3000])).toBeUndefined();
  });
});

describe("buildYearFigures et buildVolumeByYear", () => {
  it("rend une entrée par millésime demandé, même vide", () => {
    const rows = [flat({ year: 2023, date: "2023-05-01", pricePerSqm: 3000 })];
    const years = buildYearFigures(rows, [2022, 2023, 2024], "apartment");
    expect(years.map((entry) => entry.year)).toEqual([2022, 2023, 2024]);
    expect(years[0]?.sample).toBe(0);
    expect(years[1]?.sample).toBe(1);
    expect(years[2]?.median).toBeUndefined();
  });

  it("compte le volume tous types de logement confondus", () => {
    const rows = [
      flat({ year: 2024 }),
      makeTransaction({ propertyType: "house", year: 2024 }),
      makeTransaction({ propertyType: "dependency", year: 2024 }),
    ];
    const volume = buildVolumeByYear(rows, [2024]);
    expect(volume[0]?.total).toBe(2);
  });
});

describe("detectPartialYears", () => {
  const volume = (entries: [number, number][]) =>
    entries.map(([year, total]) => ({ year, total, sample: total, partial: false }));

  it("marque le millésime en cours, que le calendrier de publication rend partiel", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const partial = detectPartialYears(volume([[2024, 500], [2025, 480], [2026, 470]]), now);
    expect(partial).toContain(2026);
  });

  it("marque un millésime dont le volume s'effondre, même s'il est réputé publié", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const partial = detectPartialYears(
      volume([[2021, 500], [2022, 520], [2023, 480], [2024, 510], [2025, 120]]),
      now,
    );
    expect(partial).toContain(2025);
  });

  it("ne marque rien quand les volumes se tiennent", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    const partial = detectPartialYears(
      volume([[2021, 500], [2022, 520], [2023, 480], [2024, 510], [2025, 490]]),
      now,
    );
    expect(partial).toEqual([]);
  });
});

describe("secteurs", () => {
  it("groupe par code postal et rend le dénominateur du taux de couverture", () => {
    const rows = [
      ...Array.from({ length: 30 }, () => flat({ postcode: "44000", pricePerSqm: 4000 })),
      ...Array.from({ length: 20 }, () => flat({ postcode: "44100", pricePerSqm: 3000 })),
      // Sans code postal : la vente compte dans le dénominateur, pas dans un secteur.
      flat({ postcode: undefined, pricePerSqm: 3500 }),
    ];
    const sectors = buildSectors(rows, "postcode", postcodeLabel);
    expect(sectors?.kind).toBe("postcode");
    expect(sectors?.entries).toHaveLength(2);
    expect(sectors?.dwellingSample).toBe(51);
    expect(sectors?.entries[0]?.label).toBe("Code postal 44000");
  });

  it("rend null quand un seul secteur est identifiable", () => {
    const rows = Array.from({ length: 30 }, () => flat({ postcode: "44000" }));
    expect(buildSectors(rows, "postcode", postcodeLabel)).toBeNull();
  });

  it("nomme les arrondissements de Paris, Lyon et Marseille", () => {
    expect(arrondissementLabel("75101")).toBe("Paris 1er");
    expect(arrondissementLabel("75111")).toBe("Paris 11e");
    expect(arrondissementLabel("69383")).toBe("Lyon 3e");
    expect(arrondissementLabel("13205")).toBe("Marseille 5e");
    expect(arrondissementLabel("44109")).toBeUndefined();
  });
});
