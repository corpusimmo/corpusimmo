/**
 * Market statistics over a set of normalised mutations.
 *
 * Medians, never means, for the headline €/m²: French real-estate distributions
 * are right-skewed (a handful of exceptional sales per commune), and a mean
 * would quietly overstate a neighbourhood. `averagePrice` is exposed too, but
 * only as a secondary figure.
 */

import type { DvfPropertyType, DvfTransaction } from "@/types/dvf";

export interface MarketStats {
  count: number;
  medianPricePerSqm?: number;
  averagePrice?: number;
  medianPrice?: number;
  yearRange?: [number, number];
  byType: Record<DvfPropertyType, number>;
  /**
   * False when the sample is below `MIN_STATISTICAL_SAMPLE` mutations. In that
   * case every aggregate above is `undefined` on purpose — statistical secrecy
   * forbids publishing a figure computed on a handful of sales, and a median of
   * three transactions is misinformation anyway. The UI must say "effectif
   * insuffisant", never invent a number.
   */
  sampleSufficient: boolean;
}

const EMPTY_BY_TYPE = (): Record<DvfPropertyType, number> => ({
  apartment: 0,
  house: 0,
  land: 0,
  commercial: 0,
  dependency: 0,
  other: 0,
});

/** Below this, a "median" is anecdote, not statistics. */
const MIN_SINGLE_LOT_SAMPLE = 5;

/**
 * Statistical-secrecy floor: no aggregate is published below this many
 * mutations. Same threshold as the single-lot fallback, deliberately — one
 * number to reason about rather than two.
 */
export const MIN_STATISTICAL_SAMPLE = 5;

export function computeMarketStats(rows: DvfTransaction[]): MarketStats {
  const byType = EMPTY_BY_TYPE();
  if (rows.length === 0) return { count: 0, byType, sampleSufficient: false };

  // Counts and the year span stay available below the floor: they identify
  // nobody and the UI needs them to explain *why* the stats are withheld.
  if (rows.length < MIN_STATISTICAL_SAMPLE) {
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      byType[row.propertyType] += 1;
      if (row.year < low) low = row.year;
      if (row.year > high) high = row.year;
    }
    return {
      count: rows.length,
      byType,
      yearRange: Number.isFinite(low) && Number.isFinite(high) ? [low, high] : undefined,
      sampleSufficient: false,
    };
  }

  const prices: number[] = [];
  const singleLotUnitPrices: number[] = [];
  const allUnitPrices: number[] = [];
  let minYear = Number.POSITIVE_INFINITY;
  let maxYear = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    byType[row.propertyType] += 1;
    prices.push(row.price);
    if (row.year < minYear) minYear = row.year;
    if (row.year > maxYear) maxYear = row.year;

    if (row.pricePerSqm !== undefined) {
      allUnitPrices.push(row.pricePerSqm);
      // A multi-lot mutation divides one price by a bundle of surfaces; its
      // unit price is structurally unreliable, so it only serves as fallback.
      if (!row.isMultiLot) singleLotUnitPrices.push(row.pricePerSqm);
    }
  }

  const unitSample =
    singleLotUnitPrices.length >= MIN_SINGLE_LOT_SAMPLE ? singleLotUnitPrices : allUnitPrices;

  return {
    count: rows.length,
    medianPricePerSqm: roundOrUndefined(median(unitSample)),
    medianPrice: roundOrUndefined(median(prices)),
    averagePrice: roundOrUndefined(mean(prices)),
    yearRange: Number.isFinite(minYear) && Number.isFinite(maxYear) ? [minYear, maxYear] : undefined,
    byType,
    sampleSufficient: true,
  };
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  const low = sorted[mid - 1];
  const high = sorted[mid];
  if (low === undefined || high === undefined) return undefined;
  return (low + high) / 2;
}

export function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function roundOrUndefined(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}
