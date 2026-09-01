/**
 * Filtering shared by every provider, so `geodvf`, `cerema` and `mock` answer
 * the exact same question. Providers differ in how they *fetch*, never in what
 * a filter means.
 */

import type { BBox, LatLng } from "@/types/geo";
import type { DvfQueryFilters, DvfTransaction } from "@/types/dvf";
import { bboxContains, haversineMeters } from "@/lib/geo/distance";

/** Server-side ceiling. The client may ask for less, never for more. */
export const DVF_MAX_LIMIT = 800;
export const DVF_DEFAULT_LIMIT = 400;

export function matchesFilters(row: DvfTransaction, filters: DvfQueryFilters): boolean {
  const {
    propertyTypes,
    yearMin,
    yearMax,
    priceMin,
    priceMax,
    areaMin,
    areaMax,
    pricePerSqmMin,
    pricePerSqmMax,
  } = filters;

  if (propertyTypes && propertyTypes.length > 0 && !propertyTypes.includes(row.propertyType)) {
    return false;
  }
  if (yearMin !== undefined && row.year < yearMin) return false;
  if (yearMax !== undefined && row.year > yearMax) return false;
  if (priceMin !== undefined && row.price < priceMin) return false;
  if (priceMax !== undefined && row.price > priceMax) return false;

  // A surface filter must exclude rows with no surface: keeping them would let
  // a land sale slip into an "80–120 m²" search.
  if (areaMin !== undefined && (row.builtArea === undefined || row.builtArea < areaMin)) return false;
  if (areaMax !== undefined && (row.builtArea === undefined || row.builtArea > areaMax)) return false;
  if (
    pricePerSqmMin !== undefined &&
    (row.pricePerSqm === undefined || row.pricePerSqm < pricePerSqmMin)
  ) {
    return false;
  }
  if (
    pricePerSqmMax !== undefined &&
    (row.pricePerSqm === undefined || row.pricePerSqm > pricePerSqmMax)
  ) {
    return false;
  }

  return true;
}

export interface SelectionResult {
  rows: DvfTransaction[];
  truncated: boolean;
}

/**
 * Applies filters, orders by recency, then caps.
 *
 * Ordering before capping matters: truncating an arbitrary slice would show a
 * viewport full of 2021 sales while 2025 ones exist. Recent first is the only
 * defensible bias for a market product.
 */
export function selectRows(
  rows: readonly DvfTransaction[],
  filters: DvfQueryFilters,
  predicate?: (row: DvfTransaction) => boolean,
): SelectionResult {
  const limit = clampLimit(filters.limit);
  const kept: DvfTransaction[] = [];

  for (const row of rows) {
    if (predicate && !predicate(row)) continue;
    if (!matchesFilters(row, filters)) continue;
    kept.push(row);
  }

  kept.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));

  return { rows: kept.slice(0, limit), truncated: kept.length > limit };
}

export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DVF_DEFAULT_LIMIT;
  return Math.min(DVF_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

export function inBBox(bbox: BBox): (row: DvfTransaction) => boolean {
  return (row) => bboxContains(bbox, row.coordinates);
}

export function withinRadius(center: LatLng, radiusMeters: number): (row: DvfTransaction) => boolean {
  return (row) => haversineMeters(center, row.coordinates) <= radiusMeters;
}
