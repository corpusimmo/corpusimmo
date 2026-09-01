import { describe, expect, it } from "vitest";
import { DvfProviderError, type DvfTransaction } from "@/types/dvf";
import {
  MAX_TOTAL_ADJUSTMENT,
  computeAdjustments,
  estimateByComparison,
  rangeHalfWidth,
  robustCentralPricePerSqm,
} from "./engine";
import { MAX_SINGLE_COMPARABLE_WEIGHT, MIN_COMPARABLES } from "./comparables";
import { explainValuation } from "./explain";
import {
  TEST_NOW,
  makeFakeProvider,
  makeSubject,
  makeTransaction,
  pointAtMeters,
} from "./fixtures";

/**
 * A tidy cluster of `count` apartment sales around `pricePerSqm`, spread from
 * 80 m outwards. Each test only overrides what it is actually testing.
 */
function cluster(
  count: number,
  options: { pricePerSqm?: number; spread?: number; startMeters?: number; stepMeters?: number } = {},
): DvfTransaction[] {
  const base = options.pricePerSqm ?? 4_300;
  const spread = options.spread ?? 150;
  const start = options.startMeters ?? 80;
  const step = options.stepMeters ?? 30;

  return Array.from({ length: count }, (_, i) => {
    // Deterministic alternating offset — no RNG in tests.
    const offset = ((i % 5) - 2) * (spread / 2);
    const area = 66 + (i % 7);
    const ppsm = base + offset;
    return makeTransaction({
      id: `cmp-${i}`,
      coordinates: pointAtMeters(start + i * step),
      builtArea: area,
      price: Math.round(ppsm * area),
      pricePerSqm: undefined,
      date: i % 2 === 0 ? "2024-11-05" : "2024-04-12",
      year: i % 2 === 0 ? 2024 : 2024,
      rooms: 3,
    });
  });
}

const RUN = { now: TEST_NOW, id: "test-valuation" } as const;

describe("estimateByComparison — happy path", () => {
  it("produces a coherent, plausible valuation", async () => {
    const provider = makeFakeProvider({ all: cluster(12) });
    const result = await estimateByComparison(
      { subject: makeSubject() },
      { ...RUN, provider },
    );

    expect(result.status).toBe("computed");
    expect(result.method).toBe("comparison");
    expect(result.id).toBe("test-valuation");
    expect(result.value).toBeDefined();

    const value = result.value!;
    expect(value.low).toBeLessThan(value.central);
    expect(value.central).toBeLessThan(value.high);

    // 70 m² around 4 300 €/m² → ~300 k€.
    expect(result.pricePerSqm).toBeGreaterThan(3_800);
    expect(result.pricePerSqm).toBeLessThan(4_800);
    expect(value.central).toBeGreaterThan(250_000);
    expect(value.central).toBeLessThan(360_000);
  });

  it("exposes the raw median and mean alongside the weighted €/m²", async () => {
    const provider = makeFakeProvider({ all: cluster(12) });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.medianPricePerSqm).toBeDefined();
    expect(result.averagePricePerSqm).toBeDefined();
    // The three estimators must agree on a homogeneous sample.
    for (const v of [result.medianPricePerSqm!, result.averagePricePerSqm!]) {
      expect(Math.abs(v - result.pricePerSqm!) / result.pricePerSqm!).toBeLessThan(0.1);
    }
  });

  it("fills the audit trail", async () => {
    const rows = [
      ...cluster(10),
      makeTransaction({ id: "x1", propertyType: "house", coordinates: pointAtMeters(150) }),
      makeTransaction({ id: "x2", isMultiLot: true, coordinates: pointAtMeters(160) }),
    ];
    const provider = makeFakeProvider({ all: rows });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    const d = result.diagnostics;
    expect(d.radiusUsed).toBeGreaterThan(0);
    expect(d.candidatesFound).toBe(12);
    expect(d.retained).toBe(10);
    expect(d.rejected.reduce((a, r) => a + r.count, 0)).toBe(2);
    expect(d.dispersion).toBeGreaterThanOrEqual(0);
    expect(d.yearRange).toEqual([2024, 2024]);
    expect(d.failureReason).toBeUndefined();
  });

  it("returns comparables whose weights sum to 1", async () => {
    const provider = makeFakeProvider({ all: cluster(11) });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.comparables.length).toBe(11);
    expect(result.comparables.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
    for (const c of result.comparables) {
      expect(c.weight).toBeLessThanOrEqual(MAX_SINGLE_COMPARABLE_WEIGHT + 1e-9);
      expect(c.distance).toBeGreaterThanOrEqual(0);
      expect(c.ageMonths).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("estimateByComparison — radius escalation", () => {
  it("widens the search until the target is met, and stops there", async () => {
    const provider = makeFakeProvider({
      byRadius: {
        500: cluster(2),
        1_000: cluster(4, { startMeters: 600, stepMeters: 50 }),
        2_000: cluster(10, { startMeters: 600, stepMeters: 120 }),
        5_000: cluster(30, { startMeters: 600, stepMeters: 140 }),
      },
    });

    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("computed");
    expect(provider.radiiQueried).toEqual([500, 1_000, 2_000]);
    expect(result.diagnostics.radiusUsed).toBe(2_000);
  });

  it("does not widen when the first radius already delivers", async () => {
    const provider = makeFakeProvider({ byRadius: { 500: cluster(9, { stepMeters: 40 }) } });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("computed");
    expect(provider.radiiQueried).toEqual([500]);
    expect(result.diagnostics.radiusUsed).toBe(500);
  });

  it("stops early in a dense market rather than trading locality for volume", async () => {
    // 130 mutations within 500 m, of which only 6 are comparable apartments.
    const noise = Array.from({ length: 124 }, (_, i) =>
      makeTransaction({
        id: `noise-${i}`,
        propertyType: "house",
        coordinates: pointAtMeters(100 + i),
      }),
    );
    const provider = makeFakeProvider({
      byRadius: { 500: [...cluster(6, { stepMeters: 20 }), ...noise] },
    });

    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("computed");
    expect(provider.radiiQueried).toEqual([500]);
    expect(result.diagnostics.retained).toBe(6);
  });

  it("relaxes the surface bracket before giving up on a radius", async () => {
    // All comparables sit at +40 % surface: outside ±30 %, inside ±50 %.
    const wide = Array.from({ length: 9 }, (_, i) =>
      makeTransaction({
        id: `wide-${i}`,
        coordinates: pointAtMeters(100 + i * 30),
        builtArea: 98,
        price: Math.round(4_300 * 98) + i * 1_000,
        pricePerSqm: undefined,
      }),
    );
    const provider = makeFakeProvider({ byRadius: { 500: wide } });

    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("computed");
    expect(result.diagnostics.retained).toBe(9);
    expect(
      result.confidence.factors.some((f) => /surface élargie/i.test(f.label)),
    ).toBe(true);
  });
});

describe("estimateByComparison — refuses to invent a number", () => {
  it("fails below the absolute floor of comparables", async () => {
    const provider = makeFakeProvider({ all: cluster(3) });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("failed");
    expect(result.value).toBeUndefined();
    expect(result.pricePerSqm).toBeUndefined();
    expect(result.diagnostics.failureReason).toMatch(/Pas assez de ventes comparables/i);
    expect(result.confidence.score).toBe(0);
    // It really tried every radius before giving up.
    expect(provider.radiiQueried).toEqual([500, 1_000, 2_000, 5_000]);
  });

  it(`fails at exactly ${MIN_COMPARABLES - 1} comparables and succeeds at ${MIN_COMPARABLES}`, async () => {
    const below = await estimateByComparison(
      { subject: makeSubject() },
      { ...RUN, provider: makeFakeProvider({ all: cluster(MIN_COMPARABLES - 1) }) },
    );
    const atFloor = await estimateByComparison(
      { subject: makeSubject() },
      { ...RUN, provider: makeFakeProvider({ all: cluster(MIN_COMPARABLES) }) },
    );

    expect(below.status).toBe("failed");
    expect(atFloor.status).toBe("computed");
  });

  it("fails when the surface is missing", async () => {
    const provider = makeFakeProvider({ all: cluster(12) });
    const result = await estimateByComparison(
      { subject: makeSubject({ features: { rooms: 3 } }) },
      { ...RUN, provider },
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics.failureReason).toMatch(/surface habitable/i);
    // No point querying DVF without a reference surface.
    expect(provider.radiiQueried).toEqual([]);
  });

  it("fails on a department DVF does not publish", async () => {
    const subject = makeSubject();
    const strasbourg = {
      ...subject,
      address: { ...subject.address, departmentCode: "67", city: "Strasbourg" },
    };
    const provider = makeFakeProvider({ all: cluster(12) });
    const result = await estimateByComparison({ subject: strasbourg }, { ...RUN, provider });

    expect(result.status).toBe("failed");
    expect(result.diagnostics.failureReason).toMatch(/Alsace-Moselle/);
    expect(provider.radiiQueried).toEqual([]);
  });

  it("fails on a property type DVF cannot compare", async () => {
    const provider = makeFakeProvider({ all: cluster(12) });
    const result = await estimateByComparison(
      { subject: makeSubject({ type: "building", features: { livingArea: 400 } }) },
      { ...RUN, provider },
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics.failureReason).toMatch(/ne distinguent pas ce type de bien/i);
  });

  it("fails on an unlocated address", async () => {
    const subject = makeSubject();
    const nowhere = {
      ...subject,
      address: { ...subject.address, coordinates: { lat: 0, lng: 0 } },
    };
    const result = await estimateByComparison(
      { subject: nowhere },
      { ...RUN, provider: makeFakeProvider({ all: cluster(12) }) },
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics.failureReason).toMatch(/localisée/i);
  });

  it("degrades to a failed result — never throws — when the provider is down", async () => {
    const provider = makeFakeProvider({ fail: new DvfProviderError("Etalab timeout") });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("failed");
    expect(result.value).toBeUndefined();
    expect(result.diagnostics.failureReason).toMatch(/indisponible/i);
  });
});

describe("estimateByComparison — pro flow", () => {
  const basket = cluster(8);
  const ids = basket.map((t) => t.id);

  it("uses exactly the given ids and performs no automatic search", async () => {
    const provider = makeFakeProvider({ all: basket });
    const result = await estimateByComparison(
      { subject: makeSubject(), comparableIds: ids },
      { ...RUN, provider },
    );

    expect(result.status).toBe("computed");
    expect(provider.radiiQueried).toEqual([]);
    expect(result.comparables.map((c) => c.transaction.id).sort()).toEqual([...ids].sort());
  });

  it("honours manualWeights", async () => {
    const provider = makeFakeProvider({ all: basket });
    const request = { subject: makeSubject(), comparableIds: ids };

    const plain = await estimateByComparison(request, { ...RUN, provider });
    const boosted = await estimateByComparison(
      { ...request, manualWeights: { [ids[0]!]: 3 } },
      { ...RUN, provider: makeFakeProvider({ all: basket }) },
    );

    const weightOf = (r: typeof plain, id: string) =>
      r.comparables.find((c) => c.transaction.id === id)?.weight ?? 0;

    expect(weightOf(boosted, ids[0]!)).toBeGreaterThan(weightOf(plain, ids[0]!));
    expect(boosted.comparables.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
  });

  it("keeps excluded comparables visible but out of the maths", async () => {
    const provider = makeFakeProvider({ all: cluster(10) });
    const all = cluster(10).map((t) => t.id);
    const result = await estimateByComparison(
      { subject: makeSubject(), excludedIds: [all[0]!, all[1]!] },
      { ...RUN, provider },
    );

    expect(result.status).toBe("computed");
    const excluded = result.comparables.filter((c) => c.excluded);
    expect(excluded).toHaveLength(2);
    for (const c of excluded) expect(c.weight).toBe(0);
    expect(result.diagnostics.retained).toBe(8);
  });

  it("applies the sample floor to the pro basket too", async () => {
    const provider = makeFakeProvider({ all: basket });
    const result = await estimateByComparison(
      { subject: makeSubject(), comparableIds: ids.slice(0, 3) },
      { ...RUN, provider },
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics.failureReason).toMatch(/Pas assez de ventes comparables/i);
  });

  it("re-checks the floor after manual exclusions", async () => {
    const rows = cluster(6);
    const provider = makeFakeProvider({ all: rows });
    const result = await estimateByComparison(
      { subject: makeSubject(), excludedIds: rows.slice(0, 2).map((t) => t.id) },
      { ...RUN, provider },
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics.failureReason).toMatch(/Pas assez de ventes comparables/i);
  });
});

describe("estimateByComparison — dominance", () => {
  it("does not let one perfect twin carry the estimate", async () => {
    const twin = makeTransaction({
      id: "twin",
      coordinates: pointAtMeters(5),
      date: "2025-06-01",
      year: 2025,
      builtArea: 70,
      price: 70 * 9_000, // wildly above the local market
      pricePerSqm: undefined,
    });
    const rest = cluster(7, { startMeters: 900, stepMeters: 100 }).map((t) => ({
      ...t,
      date: "2022-03-01",
      year: 2022,
    }));

    const provider = makeFakeProvider({ all: [twin, ...rest] });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    expect(result.status).toBe("computed");
    const twinWeight =
      result.comparables.find((c) => c.transaction.id === "twin")?.weight ?? 0;
    expect(twinWeight).toBeLessThanOrEqual(MAX_SINGLE_COMPARABLE_WEIGHT + 1e-9);

    // The estimate stays anchored on the cluster, not on the single outlier.
    expect(result.pricePerSqm).toBeLessThan(6_000);
  });
});

describe("estimateByComparison — range width reflects data quality", () => {
  it("is narrower on a tight, abundant sample than on a scattered, thin one", async () => {
    const tight = await estimateByComparison(
      { subject: makeSubject() },
      { ...RUN, provider: makeFakeProvider({ all: cluster(18, { spread: 60 }) }) },
    );
    const scattered = await estimateByComparison(
      { subject: makeSubject() },
      { ...RUN, provider: makeFakeProvider({ all: cluster(6, { spread: 2_400 }) }) },
    );

    const width = (r: typeof tight) =>
      r.value ? (r.value.high - r.value.low) / r.value.central : 0;

    expect(tight.status).toBe("computed");
    expect(scattered.status).toBe("computed");
    expect(width(tight)).toBeLessThan(width(scattered));
  });

  it("never claims more precision than ±5 % nor less than ±22 %", () => {
    const best = rangeHalfWidth({ dispersion: 0, comparableCount: 100, averageAgeMonths: 0 });
    const worst = rangeHalfWidth({
      dispersion: 2,
      comparableCount: 5,
      averageAgeMonths: 60,
    });
    expect(best).toBeCloseTo(0.05, 10);
    expect(worst).toBeCloseTo(0.22, 10);
  });

  it("penalises an unmeasurable dispersion rather than assuming the best", () => {
    const known = rangeHalfWidth({
      dispersion: 0.05,
      comparableCount: 10,
      averageAgeMonths: 12,
    });
    const unknown = rangeHalfWidth({ comparableCount: 10, averageAgeMonths: 12 });
    expect(unknown).toBeGreaterThan(known);
  });
});

describe("robustCentralPricePerSqm", () => {
  it("resists a single extreme survivor", () => {
    const clean = [4_000, 4_100, 4_200, 4_300, 4_400].map((value) => ({ value, weight: 0.2 }));
    const polluted = [...clean.slice(0, 4), { value: 20_000, weight: 0.2 }];

    const a = robustCentralPricePerSqm(clean)!;
    const b = robustCentralPricePerSqm(polluted)!;
    expect(Math.abs(b - a) / a).toBeLessThan(0.15);
  });

  it("equals the plain weighted mean on a homogeneous sample", () => {
    const pairs = [4_200, 4_250, 4_300].map((value) => ({ value, weight: 1 / 3 }));
    expect(robustCentralPricePerSqm(pairs)).toBeCloseTo(4_250, 6);
  });

  it("returns undefined on an empty set", () => {
    expect(robustCentralPricePerSqm([])).toBeUndefined();
  });
});

describe("computeAdjustments", () => {
  it("is neutral on a plain, well-kept property", () => {
    const { items, total } = computeAdjustments(
      makeSubject({ features: { livingArea: 70, condition: "good" } }),
    );
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });

  it("moves in the expected direction for condition", () => {
    const toRenovate = computeAdjustments(
      makeSubject({ features: { livingArea: 70, condition: "to_renovate" } }),
    ).total;
    const brandNew = computeAdjustments(
      makeSubject({ features: { livingArea: 70, condition: "new" } }),
    ).total;

    expect(toRenovate).toBeLessThan(0);
    expect(brandNew).toBeGreaterThan(0);
  });

  it("penalises a high floor without a lift and rewards one with", () => {
    const without = computeAdjustments(
      makeSubject({ features: { livingArea: 70, floor: 4, hasElevator: false } }),
    ).total;
    const with_ = computeAdjustments(
      makeSubject({ features: { livingArea: 70, floor: 4, hasElevator: true } }),
    ).total;
    expect(without).toBeLessThan(0);
    expect(with_).toBeGreaterThan(without);
  });

  it("never exceeds the documented cap in either direction", () => {
    const maxed = computeAdjustments(
      makeSubject({
        features: {
          livingArea: 70,
          condition: "new",
          floor: 5,
          hasElevator: true,
          outdoor: "terrace",
          hasGarage: true,
        },
      }),
    );
    expect(maxed.total).toBeCloseTo(MAX_TOTAL_ADJUSTMENT, 10);
    expect(maxed.capped).toBe(true);

    const floored = computeAdjustments(
      makeSubject({
        features: { livingArea: 70, condition: "to_renovate", floor: 5, hasElevator: false },
      }),
    );
    expect(floored.total).toBeGreaterThanOrEqual(-MAX_TOTAL_ADJUSTMENT);
  });

  it("does not adjust land: state and floor are meaningless for a plot", () => {
    const { items, total } = computeAdjustments(
      makeSubject({
        type: "land",
        features: { landArea: 800, condition: "to_renovate", outdoor: "garden" },
      }),
    );
    expect(items).toEqual([]);
    expect(total).toBe(0);
  });

  it("shifts the final value, without dominating it", async () => {
    const rows = cluster(12);
    const plain = await estimateByComparison(
      { subject: makeSubject() },
      { ...RUN, provider: makeFakeProvider({ all: rows }) },
    );
    const renovate = await estimateByComparison(
      { subject: makeSubject({ features: { livingArea: 70, rooms: 3, condition: "to_renovate" } }) },
      { ...RUN, provider: makeFakeProvider({ all: rows }) },
    );

    expect(renovate.value!.central).toBeLessThan(plain.value!.central);
    const delta =
      (plain.value!.central - renovate.value!.central) / plain.value!.central;
    expect(delta).toBeLessThanOrEqual(MAX_TOTAL_ADJUSTMENT + 0.02);
  });
});

describe("estimateByComparison — land and commercial", () => {
  it("values land per m² of plot", async () => {
    const plots = Array.from({ length: 9 }, (_, i) =>
      makeTransaction({
        id: `plot-${i}`,
        propertyType: "land",
        nature: i % 2 === 0 ? "sale" : "sale_land_to_build",
        builtArea: undefined,
        rooms: undefined,
        landArea: 760 + i * 10,
        price: Math.round((120 + i) * (760 + i * 10)),
        pricePerSqm: undefined,
        coordinates: pointAtMeters(100 + i * 40),
      }),
    );
    const provider = makeFakeProvider({ all: plots });
    const result = await estimateByComparison(
      { subject: makeSubject({ type: "land", features: { landArea: 800 } }) },
      { ...RUN, provider },
    );

    expect(result.status).toBe("computed");
    expect(result.pricePerSqm).toBeGreaterThan(100);
    expect(result.pricePerSqm).toBeLessThan(140);
    expect(result.value!.central).toBeGreaterThan(80_000);
    expect(result.value!.central).toBeLessThan(115_000);
  });

  it("caps confidence and warns for commercial assets", async () => {
    const shops = Array.from({ length: 12 }, (_, i) =>
      makeTransaction({
        id: `shop-${i}`,
        propertyType: "commercial",
        builtArea: 68 + (i % 5),
        price: Math.round(3_000 * (68 + (i % 5))),
        pricePerSqm: undefined,
        rooms: undefined,
        coordinates: pointAtMeters(100 + i * 30),
      }),
    );
    const provider = makeFakeProvider({ all: shops });
    const result = await estimateByComparison(
      { subject: makeSubject({ type: "retail", features: { livingArea: 70 } }) },
      { ...RUN, provider },
    );

    expect(result.status).toBe("computed");
    expect(result.confidence.level).not.toBe("high");
    expect(
      result.confidence.factors.some((f) => /cession de parts/i.test(f.label)),
    ).toBe(true);
    expect(explainValuation(result)).toMatch(/cession de parts de société/i);
  });
});

describe("explainValuation", () => {
  it("narrates a computed valuation in plain French", async () => {
    const provider = makeFakeProvider({ all: cluster(12) });
    const result = await estimateByComparison(
      {
        subject: makeSubject({
          features: { livingArea: 70, rooms: 3, condition: "very_good", outdoor: "balcony" },
        }),
      },
      { ...RUN, provider },
    );

    const text = explainValuation(result);
    // Correct French, not a template with a gender/elision bug.
    expect(text).toContain("cet appartement");
    expect(text).not.toContain("ce appartement");
    expect(text).toMatch(/12 ventes réelles/);
    expect(text).toMatch(/€\/m²/);
    // Adjustments are disclosed, never silent.
    expect(text).toMatch(/très bon état déclaré/i);
    expect(text).toMatch(/balcon/i);
    // DVF publication lag is stated, so nobody reads this as live data.
    expect(text).toMatch(/deux fois par an/);
    // And it always lands on the disclaimer: an estimate is never an expertise.
    expect(text).toMatch(/estimation statistique/i);
    expect(text).toMatch(/non une expertise immobilière/i);
    expect(text.split(". ").length).toBeGreaterThanOrEqual(3);
  });

  it("explains a failure instead of pretending", async () => {
    const provider = makeFakeProvider({ all: cluster(2) });
    const result = await estimateByComparison({ subject: makeSubject() }, { ...RUN, provider });

    const text = explainValuation(result);
    expect(result.status).toBe("failed");
    expect(text).toMatch(/Pas assez de ventes comparables/i);
    expect(text).toMatch(/professionnel/i);
  });
});
