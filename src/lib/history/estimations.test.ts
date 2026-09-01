/**
 * L'historique est le seul endroit du site où une donnée survit à la
 * navigation. Ce qui compte ici n'est pas la mécanique de stockage (elle est
 * partagée, voir `local-store.ts`) mais ce qu'on retient d'un résultat : un
 * résumé fidèle, borné, et jamais deux fois la même estimation.
 */

import { describe, expect, it } from "vitest";

import { MAX_ESTIMATIONS, normalise, summarise, type EstimationRecord } from "./estimations";
import type { ValuationResult } from "@/types/valuation";

function valuation(overrides: Partial<ValuationResult> = {}): ValuationResult {
  return {
    id: "val-1",
    method: "comparison",
    status: "computed",
    createdAt: "2026-03-02T10:00:00.000Z",
    subject: {
      type: "apartment",
      address: {
        id: "75102_7098_00012",
        label: "12 rue de la Paix, 75002 Paris",
        kind: "housenumber",
        city: "Paris",
        cityCode: "75102",
        postcode: "75002",
        departmentCode: "75",
        coordinates: { lat: 48.869, lng: 2.331 },
        score: 0.97,
      },
      features: { livingArea: 68 },
    },
    value: { low: 610_000, central: 665_000, high: 720_000 },
    pricePerSqm: 9779,
    confidence: { score: 74, level: "moderate", factors: [] },
    comparables: [],
    diagnostics: { radiusUsed: 500, candidatesFound: 120, rejected: [], retained: 0 },
    ...overrides,
  };
}

function record(id: string, at: number): EstimationRecord {
  return {
    id,
    at,
    address: "12 rue de la Paix",
    city: "Paris",
    postcode: "75002",
    propertyType: "apartment",
    surface: 68,
    value: { low: 1, central: 2, high: 3 },
    pricePerSqm: null,
    confidence: 50,
    comparables: 0,
  };
}

describe("summarise", () => {
  it("retient l'adresse, la fourchette et la confiance", () => {
    const summary = summarise(valuation());

    expect(summary).toMatchObject({
      id: "val-1",
      address: "12 rue de la Paix, 75002 Paris",
      city: "Paris",
      postcode: "75002",
      propertyType: "apartment",
      surface: 68,
      value: { low: 610_000, central: 665_000, high: 720_000 },
      pricePerSqm: 9779,
      confidence: 74,
    });
    expect(summary.at).toBe(Date.parse("2026-03-02T10:00:00.000Z"));
  });

  it("garde aussi une estimation que le moteur n'a pas conclue", () => {
    const summary = summarise(valuation({ status: "failed", value: undefined }));

    expect(summary.value).toBeNull();
    expect(summary.address).toBe("12 rue de la Paix, 75002 Paris");
  });

  it("ne compte que les comparables retenus", () => {
    const summary = summarise(
      valuation({
        comparables: [
          { excluded: false },
          { excluded: true },
          { excluded: false },
        ] as unknown as ValuationResult["comparables"],
      }),
    );

    expect(summary.comparables).toBe(2);
  });

  it("se rabat sur la surface de terrain quand il n'y a pas de surface habitable", () => {
    const summary = summarise(
      valuation({
        subject: {
          ...valuation().subject,
          type: "land",
          features: { landArea: 450 },
        },
      }),
    );

    expect(summary.surface).toBe(450);
  });

  it("fabrique un identifiant plutôt que d'en laisser un vide", () => {
    const now = new Date("2026-03-02T12:00:00.000Z");
    expect(summarise(valuation({ id: "" }), now).id).toBe(`local-${now.getTime()}`);
  });
});

describe("normalise", () => {
  it("range du plus récent au plus ancien", () => {
    const list = normalise([record("a", 100), record("c", 300), record("b", 200)]);
    expect(list.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });

  it("ne garde qu'une entrée par identifiant, la plus récente", () => {
    const list = normalise([record("a", 100), record("a", 500)]);
    expect(list).toHaveLength(1);
    expect(list[0]?.at).toBe(500);
  });

  it("plafonne la liste sans jamais perdre les plus récentes", () => {
    const many = Array.from({ length: MAX_ESTIMATIONS + 12 }, (_, index) =>
      record(`e-${index}`, index),
    );
    const list = normalise(many);

    expect(list).toHaveLength(MAX_ESTIMATIONS);
    expect(list[0]?.id).toBe(`e-${MAX_ESTIMATIONS + 11}`);
  });
});
