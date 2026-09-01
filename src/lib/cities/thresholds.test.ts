/**
 * LES TESTS DES REFUS.
 *
 * Ce fichier ne vérifie presque rien de ce qui s'affiche : il vérifie ce qui ne
 * doit PAS s'afficher. C'est le seul garde-fou possible pour une règle
 * éditoriale, parce que son échec est silencieux — une médiane calculée sur
 * onze ventes ressemble en tout point à une médiane calculée sur mille.
 */

import { describe, expect, it } from "vitest";

import {
  MIN_CITY_DWELLING_SALES,
  MIN_DECILE_SAMPLE,
  MIN_EVOLUTION_SAMPLE,
  MIN_FIGURE_SAMPLE,
  canPublishDeciles,
  canPublishFigure,
  cityRefusal,
  evolutionOf,
  isPublishableCity,
  plottableYears,
  publishableSectors,
  sectorCoverage,
} from "./thresholds";
import type { CityAggregate, CityFigure, CityYearFigure } from "./types";

function figure(overrides: Partial<CityFigure> = {}): CityFigure {
  return {
    sample: 500,
    total: 560,
    median: 3200,
    q1: 2700,
    q3: 3800,
    d1: 2200,
    d9: 4500,
    medianPrice: 240_000,
    medianArea: 72,
    ...overrides,
  };
}

function year(overrides: Partial<CityYearFigure> = {}): CityYearFigure {
  return { year: 2024, sample: 400, total: 430, median: 3200, q1: 2900, q3: 3500, partial: false, ...overrides };
}

function city(overrides: Partial<CityAggregate> = {}): CityAggregate {
  return {
    insee: "44109",
    slug: "nantes",
    name: "Nantes",
    departmentCode: "44",
    departmentName: "Loire-Atlantique",
    population: 327_734,
    center: { lat: 47.23, lng: -1.55 },
    postcodes: ["44000"],
    sourceCodes: ["44109"],
    years: [2021, 2022, 2023, 2024, 2025],
    latestYear: 2025,
    partialYears: [],
    mutationsFound: 30_000,
    mutationsKept: 29_500,
    dwellingSales: 27_000,
    byType: { apartment: figure(), house: figure({ median: 4400 }) },
    yearlyByType: { apartment: [year()], house: [year()] },
    volumeByYear: [year()],
    sectors: null,
    ...overrides,
  };
}

describe("une page existe-t-elle", () => {
  it("refuse une commune sous le seuil de ventes", () => {
    const refusal = cityRefusal(city({ dwellingSales: MIN_CITY_DWELLING_SALES - 1 }));
    expect(refusal).toEqual({
      kind: "too_few_sales",
      sales: MIN_CITY_DWELLING_SALES - 1,
      required: MIN_CITY_DWELLING_SALES,
    });
  });

  it("refuse une commune où assez de ventes ne portent aucune médiane publiable", () => {
    // Beaucoup de ventes, mais réparties sur des types dont aucun n'atteint le
    // seuil : le cas d'une commune de dépendances et de terrains.
    const refusal = cityRefusal(
      city({
        dwellingSales: 4000,
        byType: {
          apartment: figure({ sample: MIN_FIGURE_SAMPLE - 1 }),
          house: figure({ sample: 2, median: undefined }),
        },
      }),
    );
    expect(refusal).toEqual({ kind: "no_publishable_type" });
  });

  it("accepte une commune qui franchit les deux conditions", () => {
    expect(cityRefusal(city())).toBeNull();
    expect(isPublishableCity(city())).toBe(true);
  });

  it("bascule exactement au seuil, pas un cran avant", () => {
    expect(isPublishableCity(city({ dwellingSales: MIN_CITY_DWELLING_SALES }))).toBe(true);
    expect(isPublishableCity(city({ dwellingSales: MIN_CITY_DWELLING_SALES - 1 }))).toBe(false);
  });
});

describe("publier un chiffre", () => {
  it("exige l'effectif minimal ET une médiane", () => {
    expect(canPublishFigure(figure({ sample: MIN_FIGURE_SAMPLE }))).toBe(true);
    expect(canPublishFigure(figure({ sample: MIN_FIGURE_SAMPLE - 1 }))).toBe(false);
    expect(canPublishFigure(figure({ median: undefined }))).toBe(false);
    expect(canPublishFigure(undefined)).toBe(false);
  });

  it("demande davantage pour les déciles que pour la médiane", () => {
    expect(canPublishDeciles(figure({ sample: MIN_DECILE_SAMPLE }))).toBe(true);
    expect(canPublishDeciles(figure({ sample: MIN_DECILE_SAMPLE - 1 }))).toBe(false);
    // Un effectif qui suffit à la médiane ne suffit pas aux déciles.
    expect(canPublishFigure(figure({ sample: MIN_FIGURE_SAMPLE }))).toBe(true);
    expect(canPublishDeciles(figure({ sample: MIN_FIGURE_SAMPLE }))).toBe(false);
  });
});

describe("évolution", () => {
  it("refuse quand il n'y a pas deux millésimes complets", () => {
    expect(evolutionOf([year({ year: 2024 })])).toEqual({
      status: "unavailable",
      reason: "no_complete_pair",
    });
    expect(
      evolutionOf([year({ year: 2024 }), year({ year: 2025, partial: true })]),
    ).toEqual({ status: "unavailable", reason: "no_complete_pair" });
  });

  it("ignore un millésime partiel même quand il est le plus récent", () => {
    // Sans cette règle, la chute de volume d'une publication incomplète se
    // lirait comme un effondrement du marché.
    const result = evolutionOf([
      year({ year: 2023, median: 3000 }),
      year({ year: 2024, median: 3600 }),
      year({ year: 2025, median: 1200, partial: true }),
    ]);
    expect(result.status).not.toBe("unavailable");
    if (result.status === "unavailable") return;
    expect(result.to.year).toBe(2024);
    expect(result.from.year).toBe(2023);
  });

  it("refuse quand un des deux millésimes est trop mince", () => {
    expect(
      evolutionOf([
        year({ year: 2023, sample: MIN_EVOLUTION_SAMPLE - 1 }),
        year({ year: 2024 }),
      ]),
    ).toEqual({ status: "unavailable", reason: "sample" });

    expect(
      evolutionOf([
        year({ year: 2023 }),
        year({ year: 2024, sample: MIN_EVOLUTION_SAMPLE - 1 }),
      ]),
    ).toEqual({ status: "unavailable", reason: "sample" });
  });

  it("ne conclut pas quand l'écart reste dans la marge des deux médianes", () => {
    // Écart de 1 %, sur des échantillons de 100 avec un écart interquartile
    // large : la marge dépasse largement l'écart.
    const result = evolutionOf([
      year({ year: 2023, sample: 100, median: 3000, q1: 2000, q3: 4000 }),
      year({ year: 2024, sample: 100, median: 3030, q1: 2000, q3: 4000 }),
    ]);
    expect(result.status).toBe("inconclusive");
    if (result.status !== "inconclusive") return;
    expect(result.changePercent).toBeCloseTo(1, 5);
    expect(result.marginPercent).toBeGreaterThan(Math.abs(result.changePercent));
  });

  it("conclut quand l'écart dépasse la marge, et donne son sens", () => {
    const up = evolutionOf([
      year({ year: 2023, sample: 2000, median: 3000, q1: 2800, q3: 3200 }),
      year({ year: 2024, sample: 2000, median: 3450, q1: 3200, q3: 3700 }),
    ]);
    expect(up.status).toBe("conclusive");
    if (up.status !== "conclusive") return;
    expect(up.direction).toBe("up");
    expect(up.changePercent).toBeCloseTo(15, 5);

    const down = evolutionOf([
      year({ year: 2023, sample: 2000, median: 3450, q1: 3200, q3: 3700 }),
      year({ year: 2024, sample: 2000, median: 3000, q1: 2800, q3: 3200 }),
    ]);
    expect(down.status === "conclusive" && down.direction).toBe("down");
  });

  it("prend une marge forfaitaire plutôt qu'une marge nulle quand les quartiles manquent", () => {
    const result = evolutionOf([
      year({ year: 2023, median: 3000, q1: undefined, q3: undefined }),
      year({ year: 2024, median: 3060, q1: undefined, q3: undefined }),
    ]);
    // 2 % d'écart, marge forfaitaire de 5 % : on ne conclut pas.
    expect(result.status).toBe("inconclusive");
  });

  it("compare les deux DERNIERS millésimes complets, pas les extrêmes", () => {
    const result = evolutionOf([
      year({ year: 2021, median: 1000 }),
      year({ year: 2022, median: 2000 }),
      year({ year: 2023, median: 3000 }),
      year({ year: 2024, median: 3900 }),
    ]);
    if (result.status === "unavailable") throw new Error("évolution attendue");
    expect([result.from.year, result.to.year]).toEqual([2023, 2024]);
  });
});

describe("séries annuelles", () => {
  it("ne trace que les millésimes complets assez fournis", () => {
    const plotted = plottableYears([
      year({ year: 2021, sample: MIN_FIGURE_SAMPLE - 1 }),
      year({ year: 2022, partial: true }),
      year({ year: 2023, median: undefined }),
      year({ year: 2024 }),
    ]);
    expect(plotted.map((entry) => entry.year)).toEqual([2024]);
  });
});

describe("secteurs", () => {
  const sectorCity = (entries: { code: string; sample: number }[], dwellingSample: number) =>
    city({
      sectors: {
        kind: "postcode",
        dwellingSample,
        entries: entries.map((entry) => ({
          code: entry.code,
          label: `Code postal ${entry.code}`,
          sample: entry.sample,
          total: entry.sample + 5,
          median: 3000 + Number(entry.code.slice(-2)),
        })),
      },
    });

  it("refuse un découpage de moins de trois secteurs", () => {
    const subject = sectorCity([{ code: "44000", sample: 500 }, { code: "44100", sample: 400 }], 1000);
    expect(publishableSectors(subject)).toBeNull();
  });

  it("refuse un découpage qui laisse trop de ventes hors cadre", () => {
    // Trois secteurs valides, mais ils ne couvrent que 30 % des ventes : ils
    // décrivent trois quartiers, pas la commune.
    const subject = sectorCity(
      [
        { code: "44000", sample: 100 },
        { code: "44100", sample: 100 },
        { code: "44200", sample: 100 },
      ],
      1000,
    );
    expect(sectorCoverage(subject)).toBeCloseTo(0.3, 5);
    expect(publishableSectors(subject)).toBeNull();
  });

  it("écarte les secteurs trop minces sans écarter le découpage", () => {
    const subject = sectorCity(
      [
        { code: "44000", sample: 400 },
        { code: "44100", sample: 300 },
        { code: "44200", sample: 200 },
        { code: "44300", sample: 5 },
      ],
      1000,
    );
    const sectors = publishableSectors(subject);
    expect(sectors?.map((entry) => entry.code)).not.toContain("44300");
    expect(sectors).toHaveLength(3);
  });

  it("classe les secteurs du plus cher au moins cher", () => {
    const subject = sectorCity(
      [
        { code: "44001", sample: 300 },
        { code: "44003", sample: 300 },
        { code: "44002", sample: 300 },
      ],
      1000,
    );
    const medians = publishableSectors(subject)?.map((entry) => entry.median ?? 0) ?? [];
    expect(medians).toEqual([...medians].sort((a, b) => b - a));
  });

  it("rend null quand la commune ne porte aucun découpage", () => {
    expect(publishableSectors(city({ sectors: null }))).toBeNull();
    expect(sectorCoverage(city({ sectors: null }))).toBe(0);
  });
});
