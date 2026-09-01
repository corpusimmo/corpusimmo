import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_CAPS,
  computeConfidence,
  failedConfidence,
  levelForScore,
  type ConfidenceInput,
} from "./confidence";

const GOOD: ConfidenceInput = {
  comparableCount: 16,
  dispersion: 0.08,
  averageAgeMonths: 10,
  averageDistanceMeters: 350,
  radiusUsed: 500,
};

function withInput(overrides: Partial<ConfidenceInput>): number {
  return computeConfidence({ ...GOOD, ...overrides }).score;
}

describe("computeConfidence — bounds", () => {
  it("stays within 0 and 100", () => {
    expect(withInput({})).toBeLessThanOrEqual(100);
    expect(
      withInput({
        comparableCount: 5,
        dispersion: 0.9,
        averageAgeMonths: 120,
        averageDistanceMeters: 9_000,
      }),
    ).toBeGreaterThanOrEqual(0);
  });

  it("rewards an excellent dataset with high confidence", () => {
    const result = computeConfidence(GOOD);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.level).toBe("high");
  });

  it("returns an integer score", () => {
    expect(Number.isInteger(withInput({ comparableCount: 11, dispersion: 0.17 }))).toBe(true);
  });
});

describe("computeConfidence — monotonicity", () => {
  it("increases with the number of comparables, all else equal", () => {
    const scores = [6, 8, 10, 12, 14, 16].map((comparableCount) =>
      withInput({ comparableCount, dispersion: 0.2 }),
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1] ?? 0);
    }
    expect(scores[scores.length - 1]).toBeGreaterThan(scores[0] ?? 0);
  });

  it("decreases as dispersion grows, all else equal", () => {
    const scores = [0.08, 0.15, 0.22, 0.3, 0.38].map((dispersion) =>
      withInput({ dispersion }),
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThan(scores[i - 1] ?? 0);
    }
  });

  it("decreases as the sample ages", () => {
    expect(withInput({ averageAgeMonths: 6 })).toBeGreaterThan(
      withInput({ averageAgeMonths: 30 }),
    );
  });

  it("decreases as comparables get further away", () => {
    expect(withInput({ averageDistanceMeters: 200 })).toBeGreaterThan(
      withInput({ averageDistanceMeters: 1_600 }),
    );
  });

  it("more comparables AND less dispersion always scores higher", () => {
    const worse = withInput({ comparableCount: 6, dispersion: 0.34 });
    const better = withInput({ comparableCount: 14, dispersion: 0.1 });
    expect(better).toBeGreaterThan(worse);
  });
});

describe("computeConfidence — hard caps", () => {
  it("never sells high confidence on a thin sample, however perfect it looks", () => {
    const result = computeConfidence({
      comparableCount: 5,
      dispersion: 0.01,
      averageAgeMonths: 0,
      averageDistanceMeters: 0,
      radiusUsed: 500,
    });
    expect(result.score).toBeLessThanOrEqual(CONFIDENCE_CAPS.thinSample.cap);
    expect(result.level).not.toBe("high");
  });

  it("never sells high confidence on a scattered sample", () => {
    const result = computeConfidence({
      comparableCount: 40,
      dispersion: 0.5,
      averageAgeMonths: 2,
      averageDistanceMeters: 50,
      radiusUsed: 500,
    });
    expect(result.score).toBeLessThanOrEqual(CONFIDENCE_CAPS.highDispersion.cap);
    expect(result.level).not.toBe("high");
  });

  it("caps a stale sample", () => {
    const result = computeConfidence({
      comparableCount: 40,
      dispersion: 0.05,
      averageAgeMonths: 50,
      averageDistanceMeters: 100,
      radiusUsed: 500,
    });
    expect(result.score).toBeLessThanOrEqual(CONFIDENCE_CAPS.staleSample.cap);
  });

  it("caps commercial assets DVF only partially sees", () => {
    const residential = computeConfidence(GOOD);
    const commercial = computeConfidence({ ...GOOD, poorlyCoveredByDvf: true });

    expect(commercial.score).toBeLessThanOrEqual(CONFIDENCE_CAPS.poorlyCovered.cap);
    expect(commercial.score).toBeLessThan(residential.score);
    expect(commercial.level).not.toBe("high");
    expect(
      commercial.factors.some(
        (f) => f.impact === "negative" && /cession de parts/i.test(f.label),
      ),
    ).toBe(true);
  });
});

describe("computeConfidence — factors", () => {
  it("produces French, ready-to-render labels with an impact each", () => {
    const { factors } = computeConfidence(GOOD);
    expect(factors.length).toBeGreaterThanOrEqual(4);
    for (const f of factors) {
      expect(f.label.length).toBeGreaterThan(10);
      expect(["positive", "neutral", "negative"]).toContain(f.impact);
    }
  });

  it("mentions the count and the radius on a healthy dataset", () => {
    const { factors } = computeConfidence({ ...GOOD, comparableCount: 14, radiusUsed: 600 });
    const first = factors[0];
    expect(first?.label).toContain("14");
    expect(first?.label).toContain("600 m");
    expect(first?.impact).toBe("positive");
  });

  it("flags a thin sample negatively", () => {
    const { factors } = computeConfidence({ ...GOOD, comparableCount: 5 });
    expect(factors[0]?.impact).toBe("negative");
    expect(factors[0]?.label).toMatch(/Seulement 5/);
  });

  it("flags high dispersion and old sales negatively", () => {
    const { factors } = computeConfidence({
      ...GOOD,
      dispersion: 0.42,
      averageAgeMonths: 44,
    });
    const negatives = factors.filter((f) => f.impact === "negative").map((f) => f.label);
    expect(negatives.some((l) => /[Dd]ispersion des prix élevée/.test(l))).toBe(true);
    expect(negatives.some((l) => /anciennes/.test(l))).toBe(true);
  });

  it("declares a widened surface bracket", () => {
    const { factors } = computeConfidence({ ...GOOD, relaxedAreaTolerance: true });
    expect(
      factors.some((f) => f.impact === "negative" && /surface élargie/i.test(f.label)),
    ).toBe(true);
  });

  it("says so when dispersion could not be measured", () => {
    const { factors } = computeConfidence({ ...GOOD, dispersion: undefined });
    expect(factors.some((f) => /non mesurable/i.test(f.label))).toBe(true);
  });
});

describe("levelForScore", () => {
  it("maps the three bands", () => {
    expect(levelForScore(85)).toBe("high");
    expect(levelForScore(70)).toBe("high");
    expect(levelForScore(69)).toBe("moderate");
    expect(levelForScore(45)).toBe("moderate");
    expect(levelForScore(44)).toBe("low");
    expect(levelForScore(0)).toBe("low");
  });
});

describe("failedConfidence", () => {
  it("scores zero and carries the reason as a negative factor", () => {
    const c = failedConfidence("Pas assez de ventes comparables.");
    expect(c.score).toBe(0);
    expect(c.level).toBe("low");
    expect(c.factors).toEqual([
      { label: "Pas assez de ventes comparables.", impact: "negative" },
    ]);
  });
});
