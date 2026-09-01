import { describe, expect, it } from "vitest";
import {
  clamp,
  iqrOutlierBounds,
  mean,
  median,
  quantile,
  relativeIqr,
  weightedMean,
  weightedQuantile,
  winsorize,
} from "./stats";

describe("median", () => {
  it("returns the middle value on an odd count", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([10, 2, 8, 4, 6])).toBe(6);
  });

  it("averages the two central values on an even count", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("handles a single value", () => {
    expect(median([42])).toBe(42);
  });

  it("returns undefined — never NaN — on an empty array", () => {
    const result = median([]);
    expect(result).toBeUndefined();
    expect(Number.isNaN(result)).toBe(false);
  });

  it("ignores non-finite entries instead of poisoning the result", () => {
    expect(median([1, Number.NaN, 3, Number.POSITIVE_INFINITY])).toBe(2);
  });

  it("does not mutate its input", () => {
    const input = [5, 1, 3];
    median(input);
    expect(input).toEqual([5, 1, 3]);
  });
});

describe("quantile", () => {
  it("matches the type-7 definition with linear interpolation", () => {
    const v = [1, 2, 3, 4];
    // h = (n-1)*q = 3*0.25 = 0.75 → 1 + 0.75*(2-1)
    expect(quantile(v, 0.25)).toBeCloseTo(1.75, 10);
    expect(quantile(v, 0.75)).toBeCloseTo(3.25, 10);
  });

  it("returns the extremes at q = 0 and q = 1", () => {
    expect(quantile([5, 9, 1], 0)).toBe(1);
    expect(quantile([5, 9, 1], 1)).toBe(9);
  });

  it("clamps out-of-range probabilities", () => {
    expect(quantile([1, 2, 3], -2)).toBe(1);
    expect(quantile([1, 2, 3], 4)).toBe(3);
  });

  it("returns undefined on an empty array", () => {
    expect(quantile([], 0.5)).toBeUndefined();
  });
});

describe("mean", () => {
  it("averages finite values", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it("returns undefined on an empty array", () => {
    expect(mean([])).toBeUndefined();
  });
});

describe("weightedMean", () => {
  it("weights each value", () => {
    expect(weightedMean([{ value: 10, weight: 3 }, { value: 20, weight: 1 }])).toBe(12.5);
  });

  it("equals the plain mean when weights are equal", () => {
    const values = [4, 8, 12];
    expect(weightedMean(values.map((value) => ({ value, weight: 1 })))).toBe(8);
  });

  it("ignores zero and negative weights", () => {
    expect(
      weightedMean([
        { value: 10, weight: 1 },
        { value: 1_000, weight: 0 },
        { value: 5_000, weight: -3 },
      ]),
    ).toBe(10);
  });

  it("returns undefined when nothing carries weight", () => {
    expect(weightedMean([])).toBeUndefined();
    expect(weightedMean([{ value: 10, weight: 0 }])).toBeUndefined();
  });
});

describe("weightedQuantile", () => {
  it("collapses onto the ordinary median when weights are equal", () => {
    const odd = [1, 5, 9];
    const even = [1, 5, 9, 13];
    expect(weightedQuantile(odd.map((value) => ({ value, weight: 1 })), 0.5)).toBeCloseTo(
      median(odd) ?? Number.NaN,
      10,
    );
    expect(weightedQuantile(even.map((value) => ({ value, weight: 1 })), 0.5)).toBeCloseTo(
      median(even) ?? Number.NaN,
      10,
    );
  });

  it("is pulled towards the heavily weighted observations", () => {
    const pairs = [
      { value: 100, weight: 10 },
      { value: 200, weight: 1 },
      { value: 300, weight: 1 },
    ];
    const wq = weightedQuantile(pairs, 0.5) ?? Number.NaN;
    expect(wq).toBeLessThan(200);
    expect(wq).toBeGreaterThanOrEqual(100);
  });

  it("is insensitive to input order", () => {
    const a = [
      { value: 300, weight: 2 },
      { value: 100, weight: 1 },
      { value: 200, weight: 3 },
    ];
    const b = [...a].reverse();
    expect(weightedQuantile(a, 0.5)).toBeCloseTo(weightedQuantile(b, 0.5) ?? Number.NaN, 10);
  });

  it("returns undefined on an empty or weightless input", () => {
    expect(weightedQuantile([], 0.5)).toBeUndefined();
    expect(weightedQuantile([{ value: 1, weight: 0 }], 0.5)).toBeUndefined();
  });
});

describe("iqrOutlierBounds", () => {
  it("computes Tukey fences at 1.5 IQR", () => {
    // Q1 = 1.75, Q3 = 3.25, IQR = 1.5 → [-0.5, 5.5]
    const bounds = iqrOutlierBounds([1, 2, 3, 4]);
    expect(bounds?.lower).toBeCloseTo(-0.5, 10);
    expect(bounds?.upper).toBeCloseTo(5.5, 10);
  });

  it("brackets a clean sample and excludes an obvious outlier", () => {
    const values = [3_000, 3_100, 3_200, 3_300, 3_400, 3_500, 25_000];
    const bounds = iqrOutlierBounds(values);
    expect(bounds).toBeDefined();
    expect(25_000).toBeGreaterThan(bounds?.upper ?? Number.POSITIVE_INFINITY);
    expect(3_200).toBeLessThan(bounds?.upper ?? 0);
    expect(3_200).toBeGreaterThan(bounds?.lower ?? Number.POSITIVE_INFINITY);
  });

  it("honours a custom k", () => {
    const tight = iqrOutlierBounds([1, 2, 3, 4], 1.5);
    const wide = iqrOutlierBounds([1, 2, 3, 4], 3);
    expect(wide?.upper).toBeGreaterThan(tight?.upper ?? 0);
  });

  it("refuses to invent fences below 4 points", () => {
    expect(iqrOutlierBounds([1, 2, 3])).toBeUndefined();
    expect(iqrOutlierBounds([])).toBeUndefined();
  });
});

describe("winsorize", () => {
  it("caps the tails instead of dropping them", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const capped = winsorize(values);
    expect(capped).toHaveLength(values.length);
    expect(Math.max(...capped)).toBeLessThan(100);
    expect(capped.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("leaves a homogeneous sample untouched", () => {
    expect(winsorize([5, 5, 5, 5])).toEqual([5, 5, 5, 5]);
  });

  it("returns an empty array for an empty input", () => {
    expect(winsorize([])).toEqual([]);
  });
});

describe("relativeIqr", () => {
  it("is scale-free", () => {
    const small = relativeIqr([100, 110, 120, 130]);
    const big = relativeIqr([1_000, 1_100, 1_200, 1_300]);
    expect(small).toBeCloseTo(big ?? Number.NaN, 10);
  });

  it("is zero on an identical sample", () => {
    expect(relativeIqr([3_000, 3_000, 3_000, 3_000])).toBe(0);
  });

  it("returns undefined when not computable", () => {
    expect(relativeIqr([])).toBeUndefined();
    expect(relativeIqr([42])).toBeUndefined();
  });
});

describe("clamp", () => {
  it("bounds on both sides", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
