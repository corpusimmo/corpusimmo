/**
 * Small, dependency-free statistics toolbox for the valuation engine.
 *
 * Design rules, because this module decides what number a user is shown:
 * - Every function returns `undefined` rather than `NaN` when the input cannot
 *   support the computation. A `NaN` propagates silently into a price; an
 *   `undefined` forces the caller to decide what to do.
 * - Non-finite inputs are dropped, never coerced to 0 — a missing surface must
 *   not become a free flat.
 * - Nothing mutates its argument.
 */

/** Keeps only usable numbers. Shared by every estimator below. */
function finiteOnly(values: readonly number[]): number[] {
  return values.filter((v) => Number.isFinite(v));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: readonly number[]): number | undefined {
  const clean = finiteOnly(values);
  if (clean.length === 0) return undefined;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

/**
 * Type-7 quantile (the R / numpy default): linear interpolation between the
 * two surrounding order statistics. Chosen because it is the definition a
 * professional auditing the result would reproduce in a spreadsheet.
 *
 * @param q in [0, 1]; values outside are clamped.
 */
export function quantile(values: readonly number[], q: number): number | undefined {
  const sorted = finiteOnly(values).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return undefined;
  if (n === 1) return sorted[0];

  const p = clamp(q, 0, 1);
  const h = (n - 1) * p;
  const lowIndex = Math.floor(h);
  const highIndex = Math.min(lowIndex + 1, n - 1);
  const low = sorted[lowIndex];
  const high = sorted[highIndex];
  if (low === undefined || high === undefined) return undefined;
  return low + (h - lowIndex) * (high - low);
}

/** Median. Even counts average the two central values. */
export function median(values: readonly number[]): number | undefined {
  return quantile(values, 0.5);
}

export function weightedMean(
  pairs: readonly { value: number; weight: number }[],
): number | undefined {
  let sum = 0;
  let totalWeight = 0;
  for (const p of pairs) {
    if (!Number.isFinite(p.value) || !Number.isFinite(p.weight) || p.weight <= 0) continue;
    sum += p.value * p.weight;
    totalWeight += p.weight;
  }
  if (totalWeight <= 0) return undefined;
  return sum / totalWeight;
}

/**
 * Weighted quantile using the "cumulative midpoint" convention: each
 * observation covers the probability interval centred on the middle of its own
 * weight. With equal weights this collapses exactly onto `quantile()` above,
 * which is what makes it testable against a familiar reference.
 */
export function weightedQuantile(
  pairs: readonly { value: number; weight: number }[],
  q: number,
): number | undefined {
  const clean = pairs
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.weight) && p.weight > 0)
    .sort((a, b) => a.value - b.value);
  if (clean.length === 0) return undefined;
  if (clean.length === 1) return clean[0]?.value;

  const total = clean.reduce((acc, p) => acc + p.weight, 0);
  if (total <= 0) return undefined;

  // Probability position of each observation.
  const positions: number[] = [];
  let cumulative = 0;
  for (const p of clean) {
    positions.push((cumulative + p.weight / 2) / total);
    cumulative += p.weight;
  }

  const target = clamp(q, 0, 1);
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (first === undefined || last === undefined) return undefined;
  if (target <= first) return clean[0]?.value;
  if (target >= last) return clean[clean.length - 1]?.value;

  for (let i = 1; i < positions.length; i += 1) {
    const pHigh = positions[i];
    const pLow = positions[i - 1];
    const vHigh = clean[i]?.value;
    const vLow = clean[i - 1]?.value;
    if (pHigh === undefined || pLow === undefined || vHigh === undefined || vLow === undefined) {
      continue;
    }
    if (target <= pHigh) {
      const span = pHigh - pLow;
      if (span <= 0) return vLow;
      return vLow + ((target - pLow) / span) * (vHigh - vLow);
    }
  }
  return clean[clean.length - 1]?.value;
}

/**
 * Tukey fences. `k = 1.5` is the classic "outlier" threshold; `3` would be
 * "extreme outlier". We keep 1.5 because a real-estate price distribution is
 * already right-skewed and we would rather drop a borderline sale than let it
 * pull the estimate.
 *
 * Needs at least 4 points — below that an IQR is meaningless and we return
 * `undefined` so the caller skips the filter instead of inventing bounds.
 */
export function iqrOutlierBounds(
  values: readonly number[],
  k = 1.5,
): { lower: number; upper: number } | undefined {
  const clean = finiteOnly(values);
  if (clean.length < 4) return undefined;
  const q1 = quantile(clean, 0.25);
  const q3 = quantile(clean, 0.75);
  if (q1 === undefined || q3 === undefined) return undefined;
  const iqr = q3 - q1;
  return { lower: q1 - k * iqr, upper: q3 + k * iqr };
}

/**
 * Caps (does not drop) the tails at the given quantiles. Used before the
 * weighted mean: every retained sale keeps its weight, but a survivor of the
 * IQR filter sitting far out cannot drag the central value.
 */
export function winsorize(
  values: readonly number[],
  lowerQ = 0.1,
  upperQ = 0.9,
): number[] {
  const clean = finiteOnly(values);
  if (clean.length === 0) return [];
  const lo = quantile(clean, lowerQ);
  const hi = quantile(clean, upperQ);
  if (lo === undefined || hi === undefined) return clean;
  return clean.map((v) => clamp(v, lo, hi));
}

/**
 * Relative dispersion: (Q3 − Q1) / median. Scale-free, so a 4 000 €/m² Paris
 * street and a 1 200 €/m² village are comparable. Drives both the range width
 * and the confidence score.
 */
export function relativeIqr(values: readonly number[]): number | undefined {
  const clean = finiteOnly(values);
  if (clean.length < 2) return undefined;
  const q1 = quantile(clean, 0.25);
  const q3 = quantile(clean, 0.75);
  const med = median(clean);
  if (q1 === undefined || q3 === undefined || med === undefined || med <= 0) return undefined;
  return (q3 - q1) / med;
}
