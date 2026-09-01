import { describe, expect, it } from "vitest";
import {
  AREA_TOLERANCE_RELAXED,
  MAX_SINGLE_COMPARABLE_WEIGHT,
  REJECT_REASONS,
  ageInMonths,
  capWeights,
  filterCandidates,
  scoreComparables,
  subjectArea,
  transactionPricePerSqm,
} from "./comparables";
import { TEST_NOW, makeSubject, makeTransaction, pointAtMeters } from "./fixtures";

function countFor(
  rejected: { reason: string; count: number }[],
  reason: string,
): number {
  return rejected.find((r) => r.reason === reason)?.count ?? 0;
}

describe("filterCandidates — hard rules", () => {
  const subject = makeSubject(); // apartment, 70 m², 3 rooms

  it("keeps a clean comparable", () => {
    const { kept, rejected } = filterCandidates(subject, [makeTransaction()], {
      now: TEST_NOW,
    });
    expect(kept).toHaveLength(1);
    expect(rejected).toEqual([]);
  });

  it("rejects an incompatible property type and never blends families", () => {
    const rows = [
      makeTransaction({ propertyType: "house" }),
      makeTransaction({ propertyType: "land", builtArea: undefined, landArea: 70 }),
      makeTransaction({ propertyType: "commercial" }),
      makeTransaction(),
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(1);
    expect(kept[0]?.propertyType).toBe("apartment");
    expect(countFor(rejected, REJECT_REASONS.type)).toBe(3);
  });

  it("rejects multi-lot mutations: the price covers more than one asset", () => {
    const rows = [makeTransaction({ isMultiLot: true, lotCount: 4 }), makeTransaction()];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(1);
    expect(countFor(rejected, REJECT_REASONS.multiLot)).toBe(1);
  });

  it("rejects non-arm's-length mutations", () => {
    const rows = [
      makeTransaction({ nature: "exchange" }),
      makeTransaction({ nature: "auction" }),
      makeTransaction({ nature: "expropriation" }),
      makeTransaction({ nature: "other" }),
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(0);
    expect(countFor(rejected, REJECT_REASONS.nature)).toBe(4);
  });

  it("rejects off-plan sales for an existing property, but keeps them for a new one", () => {
    const vefa = [makeTransaction({ nature: "sale_off_plan" })];

    const existing = filterCandidates(subject, vefa, { now: TEST_NOW });
    expect(existing.kept).toHaveLength(0);
    expect(countFor(existing.rejected, REJECT_REASONS.offPlan)).toBe(1);

    const newBuild = makeSubject({
      features: { livingArea: 70, rooms: 3, condition: "new" },
    });
    expect(filterCandidates(newBuild, vefa, { now: TEST_NOW }).kept).toHaveLength(1);
  });

  it("rejects rows without a usable surface", () => {
    const rows = [
      makeTransaction({ builtArea: undefined, pricePerSqm: undefined }),
      makeTransaction({ builtArea: 0, pricePerSqm: undefined }),
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(0);
    expect(countFor(rejected, REJECT_REASONS.noArea)).toBe(2);
  });

  it("rejects surfaces outside the ±30 % bracket, on both sides", () => {
    const rows = [
      makeTransaction({ builtArea: 40, price: 180_000, pricePerSqm: undefined }), // −43 %
      makeTransaction({ builtArea: 100, price: 430_000, pricePerSqm: undefined }), // +43 %
      makeTransaction({ builtArea: 60, price: 258_000, pricePerSqm: undefined }), // −14 % ok
      makeTransaction({ builtArea: 88, price: 378_000, pricePerSqm: undefined }), // +26 % ok
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(2);
    expect(countFor(rejected, REJECT_REASONS.areaGap)).toBe(2);
  });

  it("accepts the same rows once the bracket is relaxed to ±50 %", () => {
    const rows = [
      makeTransaction({ builtArea: 40, price: 180_000, pricePerSqm: undefined }),
      makeTransaction({ builtArea: 100, price: 430_000, pricePerSqm: undefined }),
    ];
    const { kept } = filterCandidates(subject, rows, {
      now: TEST_NOW,
      areaTolerance: AREA_TOLERANCE_RELAXED,
    });
    expect(kept).toHaveLength(2);
  });

  it("rejects mutations older than 60 months", () => {
    const rows = [
      makeTransaction({ date: "2019-01-10", year: 2019 }), // ~77 months
      makeTransaction({ date: "2024-01-10", year: 2024 }),
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(1);
    expect(countFor(rejected, REJECT_REASONS.tooOld)).toBe(1);
  });

  it("rejects absurd €/m² on both sides via the absolute guard", () => {
    const rows = [
      // 70 m² for 14 000 € → 200 €/m², below the 300 €/m² rail
      makeTransaction({ price: 14_000, pricePerSqm: undefined }),
      // 70 m² for 2.1 M€ → 30 000 €/m², above the 25 000 €/m² rail
      makeTransaction({ price: 2_100_000, pricePerSqm: undefined }),
      makeTransaction(),
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(1);
    expect(countFor(rejected, REJECT_REASONS.priceGuard)).toBe(2);
  });

  it("counts each rejection motive separately", () => {
    const rows = [
      makeTransaction({ propertyType: "house" }),
      makeTransaction({ isMultiLot: true }),
      makeTransaction({ nature: "exchange" }),
      makeTransaction({ builtArea: 20, price: 90_000, pricePerSqm: undefined }),
      makeTransaction({ date: "2018-05-01", year: 2018 }),
      makeTransaction(),
    ];
    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });

    expect(kept).toHaveLength(1);
    expect(countFor(rejected, REJECT_REASONS.type)).toBe(1);
    expect(countFor(rejected, REJECT_REASONS.multiLot)).toBe(1);
    expect(countFor(rejected, REJECT_REASONS.nature)).toBe(1);
    expect(countFor(rejected, REJECT_REASONS.areaGap)).toBe(1);
    expect(countFor(rejected, REJECT_REASONS.tooOld)).toBe(1);
    // Every dropped row is accounted for exactly once.
    expect(rejected.reduce((a, r) => a + r.count, 0)).toBe(rows.length - kept.length);
  });
});

describe("filterCandidates — statistical outliers", () => {
  const subject = makeSubject();

  it("drops an IQR outlier that survived the absolute guard", () => {
    // Homogeneous cluster around 4 300 €/m² plus one at ~12 900 €/m²: inside
    // the absolute rails, but nowhere near this street's market.
    const rows = [
      ...[4_200, 4_250, 4_300, 4_350, 4_400, 4_450].map((ppsm) =>
        makeTransaction({ price: ppsm * 70, builtArea: 70, pricePerSqm: undefined }),
      ),
      makeTransaction({ price: 12_900 * 70, builtArea: 70, pricePerSqm: undefined }),
    ];

    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(6);
    expect(countFor(rejected, REJECT_REASONS.priceOutlier)).toBe(1);
  });

  it("computes the fences on survivors only, so noise cannot widen them", () => {
    // The multi-lot row carries a wild €/m². If it fed the IQR it would inflate
    // the fences and let the 11 000 €/m² row through.
    const rows = [
      ...[4_200, 4_250, 4_300, 4_350, 4_400, 4_450].map((ppsm) =>
        makeTransaction({ price: ppsm * 70, builtArea: 70, pricePerSqm: undefined }),
      ),
      makeTransaction({
        price: 24_000 * 70,
        builtArea: 70,
        isMultiLot: true,
        pricePerSqm: undefined,
      }),
      makeTransaction({ price: 11_000 * 70, builtArea: 70, pricePerSqm: undefined }),
    ];

    const { kept, rejected } = filterCandidates(subject, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(6);
    expect(countFor(rejected, REJECT_REASONS.multiLot)).toBe(1);
    expect(countFor(rejected, REJECT_REASONS.priceOutlier)).toBe(1);
  });
});

describe("filterCandidates — land", () => {
  const land = makeSubject({
    type: "land",
    features: { landArea: 800 },
  });

  it("works on plot surface and its own price rails", () => {
    const rows = [
      makeTransaction({
        propertyType: "land",
        nature: "sale_land_to_build",
        builtArea: undefined,
        landArea: 750,
        rooms: undefined,
        price: 90_000,
        pricePerSqm: undefined,
      }),
      makeTransaction({
        propertyType: "land",
        builtArea: undefined,
        landArea: 900,
        rooms: undefined,
        price: 108_000,
        pricePerSqm: undefined,
      }),
    ];
    const { kept } = filterCandidates(land, rows, { now: TEST_NOW });
    expect(kept).toHaveLength(2);
    expect(subjectArea(land)).toBe(800);
    expect(transactionPricePerSqm(rows[0]!, "land")).toBeCloseTo(120, 6);
  });
});

describe("filterCandidates — refuses to guess", () => {
  it("keeps nothing when the subject type has no DVF equivalent", () => {
    const building = makeSubject({ type: "building", features: { livingArea: 400 } });
    const { kept } = filterCandidates(building, [makeTransaction()], { now: TEST_NOW });
    expect(kept).toHaveLength(0);
  });

  it("keeps nothing when the subject has no reference surface", () => {
    const noArea = makeSubject({ features: { rooms: 3 } });
    const { kept } = filterCandidates(noArea, [makeTransaction()], { now: TEST_NOW });
    expect(kept).toHaveLength(0);
  });
});

describe("ageInMonths", () => {
  it("counts whole months and clamps future dates to zero", () => {
    expect(ageInMonths("2025-06-15", TEST_NOW)).toBe(0);
    expect(ageInMonths("2024-06-15", TEST_NOW)).toBe(12);
    expect(ageInMonths("2030-01-01", TEST_NOW)).toBe(0);
  });

  it("treats an unparsable date as infinitely old rather than fresh", () => {
    expect(ageInMonths("not-a-date", TEST_NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("scoreComparables", () => {
  const subject = makeSubject();

  it("weighs a close, recent comparable strictly more than a far, old one", () => {
    const near = makeTransaction({
      id: "near",
      coordinates: pointAtMeters(100),
      date: "2025-04-01",
      year: 2025,
    });
    const far = makeTransaction({
      id: "far",
      coordinates: pointAtMeters(1_800),
      date: "2021-01-15",
      year: 2021,
    });

    const [a, b] = scoreComparables(subject, [near, far], 2_000, { now: TEST_NOW });
    expect(a?.weight).toBeGreaterThan(b?.weight ?? 0);
    expect(a?.scores.distance).toBeGreaterThan(b?.scores.distance ?? 0);
    expect(a?.scores.recency).toBeGreaterThan(b?.scores.recency ?? 0);
  });

  it("normalises weights to 1", () => {
    const rows = [
      makeTransaction({ coordinates: pointAtMeters(80) }),
      makeTransaction({ coordinates: pointAtMeters(400), date: "2023-02-01", year: 2023 }),
      makeTransaction({ coordinates: pointAtMeters(900), builtArea: 60, price: 260_000 }),
      makeTransaction({ coordinates: pointAtMeters(1_200), rooms: 4 }),
      makeTransaction({ coordinates: pointAtMeters(300), rooms: undefined }),
    ];
    const scored = scoreComparables(subject, rows, 2_000, { now: TEST_NOW });
    const total = scored.reduce((acc, c) => acc + c.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("prefers a matching room count and stays neutral — not perfect — when DVF is silent", () => {
    const exact = makeTransaction({ id: "exact", rooms: 3 });
    const unknown = makeTransaction({ id: "unknown", rooms: undefined });
    const mismatch = makeTransaction({ id: "mismatch", rooms: 6 });

    const scored = scoreComparables(subject, [exact, unknown, mismatch], 1_000, {
      now: TEST_NOW,
    });
    const byId = Object.fromEntries(scored.map((c) => [c.transaction.id, c]));

    expect(byId.exact?.scores.type).toBe(1);
    expect(byId.unknown?.scores.type).toBeLessThan(1);
    expect(byId.unknown?.scores.type).toBeGreaterThan(byId.mismatch?.scores.type ?? 1);
  });

  it("keeps every sub-score inside [0, 1]", () => {
    const rows = [
      makeTransaction({ coordinates: pointAtMeters(4_800), date: "2020-08-01", year: 2020 }),
      makeTransaction({ builtArea: 105, price: 450_000, rooms: 9 }),
    ];
    for (const c of scoreComparables(subject, rows, 5_000, { now: TEST_NOW })) {
      for (const score of Object.values(c.scores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });

  describe("pro overrides", () => {
    const rows = [
      makeTransaction({ id: "a", coordinates: pointAtMeters(200) }),
      makeTransaction({ id: "b", coordinates: pointAtMeters(250) }),
      makeTransaction({ id: "c", coordinates: pointAtMeters(300) }),
      makeTransaction({ id: "d", coordinates: pointAtMeters(350) }),
      makeTransaction({ id: "e", coordinates: pointAtMeters(400) }),
    ];

    it("multiplies the computed weight by manualWeights", () => {
      const base = scoreComparables(subject, rows, 1_000, { now: TEST_NOW });
      const boosted = scoreComparables(subject, rows, 1_000, {
        now: TEST_NOW,
        manualWeights: { b: 3 },
      });

      const baseB = base.find((c) => c.transaction.id === "b")?.weight ?? 0;
      const boostedB = boosted.find((c) => c.transaction.id === "b")?.weight ?? 0;
      expect(boostedB).toBeGreaterThan(baseB);
      expect(boosted.find((c) => c.transaction.id === "b")?.manualWeight).toBe(3);
      expect(boosted.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
    });

    it("clamps a manual weight of 0 to a zero contribution", () => {
      const scored = scoreComparables(subject, rows, 1_000, {
        now: TEST_NOW,
        manualWeights: { c: 0 },
      });
      expect(scored.find((x) => x.transaction.id === "c")?.weight).toBe(0);
      expect(scored.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
    });

    it("keeps excluded rows visible with a zero weight and a reason", () => {
      const scored = scoreComparables(subject, rows, 1_000, {
        now: TEST_NOW,
        excludedIds: ["a", "e"],
      });

      expect(scored).toHaveLength(5);
      const excluded = scored.filter((c) => c.excluded);
      expect(excluded.map((c) => c.transaction.id).sort()).toEqual(["a", "e"]);
      for (const c of excluded) {
        expect(c.weight).toBe(0);
        expect(c.exclusionReason).toBeTruthy();
      }
      expect(scored.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
    });
  });

  describe("dominance guard", () => {
    it("never lets a single comparable exceed the cap", () => {
      // One comparable is a perfect twin next door; the four others are far,
      // old and mismatched. Without the cap it would carry the whole estimate.
      const rows = [
        makeTransaction({ id: "twin", coordinates: pointAtMeters(5), date: "2025-06-01", year: 2025 }),
        ...[2_000, 2_400, 2_800, 3_200].map((d, i) =>
          makeTransaction({
            id: `far-${i}`,
            coordinates: pointAtMeters(d),
            date: "2020-09-01",
            year: 2020,
            builtArea: 92,
            price: 390_000,
            rooms: 5,
            pricePerSqm: undefined,
          }),
        ),
      ];

      const scored = scoreComparables(subject, rows, 5_000, { now: TEST_NOW });
      const twin = scored.find((c) => c.transaction.id === "twin");

      expect(twin?.weight).toBeLessThanOrEqual(MAX_SINGLE_COMPARABLE_WEIGHT + 1e-9);
      // …and it is still the heaviest one: the cap rebalances, it does not sort.
      expect(twin?.weight).toBe(Math.max(...scored.map((c) => c.weight)));
      expect(scored.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
    });

    it("neutralises a pro's extreme manual weight too", () => {
      const rows = [1, 2, 3, 4, 5].map((i) =>
        makeTransaction({ id: `p${i}`, coordinates: pointAtMeters(200 * i) }),
      );
      const scored = scoreComparables(subject, rows, 1_000, {
        now: TEST_NOW,
        manualWeights: { p1: 3 },
      });
      expect(scored.find((c) => c.transaction.id === "p1")?.weight).toBeLessThanOrEqual(
        MAX_SINGLE_COMPARABLE_WEIGHT + 1e-9,
      );
    });
  });
});

describe("capWeights", () => {
  it("preserves the total while enforcing the cap", () => {
    const capped = capWeights([0.9, 0.04, 0.03, 0.02, 0.01], 0.4);
    expect(capped.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(Math.max(...capped)).toBeLessThanOrEqual(0.4 + 1e-9);
  });

  it("leaves an already-balanced vector untouched", () => {
    const input = [0.2, 0.2, 0.2, 0.2, 0.2];
    expect(capWeights(input, 0.4)).toEqual(input);
  });

  it("handles several rows over the cap at once", () => {
    const capped = capWeights([0.45, 0.45, 0.05, 0.05], 0.4);
    expect(Math.max(...capped)).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(capped.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("leaves the vector alone when the cap is arithmetically impossible", () => {
    // Two rows cannot both stay under 40 % and still sum to 1. Flattening them
    // would destroy the real ordering; the sample floor handles this case.
    expect(capWeights([0.8, 0.2], 0.4)).toEqual([0.8, 0.2]);
  });

  it("applies as soon as the cap becomes satisfiable", () => {
    const capped = capWeights([0.8, 0.1, 0.1], 0.4);
    expect(Math.max(...capped)).toBeCloseTo(0.4, 10);
    expect(capped.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("ignores zero-weight (excluded) rows when redistributing", () => {
    const capped = capWeights([0.9, 0.1, 0], 0.4);
    expect(capped[2]).toBe(0);
    expect(capped.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});
