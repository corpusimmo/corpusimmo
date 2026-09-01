/**
 * Selection and weighting of DVF comparables.
 *
 * The whole method has to be auditable line by line by a professional, so
 * every threshold below is a named constant with the reason it exists. If a
 * number here is wrong, an estimate is wrong — there is no model to hide behind.
 */

import { haversineMeters } from "@/lib/geo/distance";
import type { DvfPropertyType, DvfTransaction } from "@/types/dvf";
import type { PropertyDraft, PropertyType } from "@/types/property";
import type { Comparable } from "@/types/valuation";
import { clamp, iqrOutlierBounds } from "./stats";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Search escalation. We stop at the first radius that is good enough. */
export const SEARCH_RADII_METERS = [500, 1000, 2000, 5000] as const;

/** Target set size. Below this we widen the search. */
export const TARGET_COMPARABLES = 8;

/**
 * ABSOLUTE floor, not a tolerance.
 *
 * Statistically, under 5 retained sales the dispersion estimate is pure noise.
 * Legally, DVF reuse is framed by the décret du 28/12/2018 and published
 * aggregates fall under statistical secrecy (loi de 1951): a value derived from
 * two or three mutations is close to republishing those mutations. Below this
 * count the engine returns `status: "failed"` — never a computed number.
 */
export const MIN_COMPARABLES = 5;

/**
 * Dominance guard. No single comparable may carry more than this share of the
 * total weight, whatever the sub-scores or the pro's manual weight say.
 *
 * Without it, one very close and very recent sale can reach 85 %+ of the weight
 * and the "estimate by comparison" silently becomes "the price of that one
 * flat" — an individual transaction re-published through an average.
 *
 * We cap rather than widen the radius: capping is deterministic, keeps the
 * retained set (and therefore the audit trail) intact, and cannot spiral into
 * fetching an ever-larger area. Widening would trade locality for balance and
 * change the answer for reasons the user cannot see.
 *
 * 40 % is feasible by construction: with `MIN_COMPARABLES` = 5 retained rows,
 * 5 × 0.40 = 2.0 ≥ 1.
 */
export const MAX_SINGLE_COMPARABLE_WEIGHT = 0.4;

/**
 * DVF publishes ~5 years of mutations. Beyond 60 months a sale says more about
 * the 2020 market than about this street today.
 */
export const MAX_AGE_MONTHS = 60;

/** Default surface bracket around the subject. */
export const AREA_TOLERANCE = 0.3;
/** Relaxed bracket, used only when the strict one starves the set. */
export const AREA_TOLERANCE_RELAXED = 0.5;

/**
 * Absolute sanity rails on €/m². They catch DVF encoding accidents (a price in
 * centimes, a surface of 1 m² on a whole building) that an IQR computed on a
 * polluted sample would not. Deliberately wide: they are a guard, not a filter.
 */
export const PRICE_PER_SQM_GUARDS: Record<AreaBasis, { min: number; max: number }> = {
  built: { min: 300, max: 25_000 },
  land: { min: 5, max: 3_000 },
};

/** Tukey multiplier for the €/m² outlier fences. */
export const IQR_FENCE_K = 1.5;

/**
 * Recency half-life: a sale 30 months old counts half as much as one closed
 * today. Roughly one French market half-cycle.
 */
export const RECENCY_HALF_LIFE_MONTHS = 30;

/**
 * Relative surface gap at which the surface sub-score falls to 0.5.
 * Steeper than the filter tolerance on purpose: being *inside* the bracket is
 * a right to participate, not a right to weigh as much as a twin.
 */
export const AREA_SCORE_HALF_GAP = 0.2;

/**
 * Sub-score used when DVF does not publish the room count. It is deliberately
 * NOT 1: we do not know whether the typology matches, so an unknown must not
 * outrank a verified match. It is not 0 either — absence of data is not a
 * mismatch. 0.7 is the documented "unknown" value.
 */
export const UNKNOWN_ROOMS_SCORE = 0.7;

/** Floor of the typology sub-score, so a room mismatch never zeroes a weight. */
export const MIN_TYPE_SCORE = 0.35;

/**
 * Exponents of the weighted geometric mean that combines the four sub-scores.
 * They sum to 1, so the final weight stays in [0, 1].
 *
 * Geometric rather than arithmetic: a mean lets one excellent sub-score rescue
 * a catastrophic one (a sale 4 km away that happens to be recent), which is
 * exactly the silent error we cannot afford. A product punishes any single
 * disqualifying dimension.
 */
export const SCORE_EXPONENTS = {
  distance: 0.35,
  recency: 0.25,
  area: 0.25,
  type: 0.15,
} as const;

/** Average days per month, used to turn a date delta into whole months. */
const DAYS_PER_MONTH = 30.436875;
const MS_PER_MONTH = DAYS_PER_MONTH * 24 * 60 * 60 * 1000;

/**
 * A subject is "neuf" (and may therefore be compared to VEFA sales) when it is
 * declared new, or built within the last 5 years.
 */
export const NEW_BUILD_MAX_AGE_YEARS = 5;

// ---------------------------------------------------------------------------
// Rejection vocabulary (rendered as-is in the "méthodologie" block)
// ---------------------------------------------------------------------------

export const REJECT_REASONS = {
  outOfRadius: "Hors du rayon de recherche retenu",
  type: "Type de bien différent",
  nature: "Mutation qui n'est pas une vente de gré à gré",
  offPlan: "Vente en l'état futur d'achèvement (bien neuf)",
  multiLot: "Vente groupée de plusieurs lots",
  noPrice: "Prix de vente absent ou nul",
  noArea: "Surface non renseignée dans DVF",
  areaGap: "Surface trop éloignée de celle du bien",
  tooOld: "Vente de plus de 5 ans",
  priceGuard: "Prix au m² hors des bornes plausibles",
  priceOutlier: "Prix au m² atypique par rapport au secteur",
} as const;

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

export type AreaBasis = "built" | "land";

/**
 * How a product property type maps onto what DVF can actually distinguish.
 * `undefined` means DVF has no honest equivalent — we refuse the comparison
 * rather than silently blend families.
 */
export const DVF_TYPE_BY_PROPERTY_TYPE: Record<PropertyType, DvfPropertyType | undefined> = {
  apartment: "apartment",
  house: "house",
  land: "land",
  parking: "dependency",
  retail: "commercial",
  office: "commercial",
  business_premises: "commercial",
  // DVF has no "immeuble" category: a block of flats is recorded lot by lot.
  building: undefined,
  other: undefined,
};

/** Land is priced per m² of plot; everything else per m² of built surface. */
export function areaBasisFor(type: PropertyType): AreaBasis {
  return type === "land" ? "land" : "built";
}

/** The surface a transaction should be measured against, per basis. */
export function transactionArea(tx: DvfTransaction, basis: AreaBasis): number | undefined {
  const area = basis === "land" ? tx.landArea : tx.builtArea;
  return area !== undefined && Number.isFinite(area) && area > 0 ? area : undefined;
}

/**
 * €/m² for the given basis. We recompute instead of trusting `tx.pricePerSqm`,
 * which is built on `builtArea` only and is therefore wrong for land.
 */
export function transactionPricePerSqm(
  tx: DvfTransaction,
  basis: AreaBasis,
): number | undefined {
  const area = transactionArea(tx, basis);
  if (area === undefined) return undefined;
  if (!Number.isFinite(tx.price) || tx.price <= 0) return undefined;
  return tx.price / area;
}

/** The subject's own reference surface. */
export function subjectArea(subject: PropertyDraft): number | undefined {
  const basis = areaBasisFor(subject.type);
  const area = basis === "land" ? subject.features.landArea : subject.features.livingArea;
  return area !== undefined && Number.isFinite(area) && area > 0 ? area : undefined;
}

export function isNewBuildSubject(subject: PropertyDraft, now: Date): boolean {
  if (subject.features.condition === "new") return true;
  const year = subject.features.constructionYear;
  if (year === undefined) return false;
  return now.getFullYear() - year <= NEW_BUILD_MAX_AGE_YEARS;
}

/** Whole months between a mutation date and `now`. Negative deltas clamp to 0. */
export function ageInMonths(isoDate: string, now: Date): number {
  const d = new Date(isoDate);
  const t = d.getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_MONTH));
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export interface FilterOptions {
  /** Relative surface bracket. Defaults to `AREA_TOLERANCE`. */
  areaTolerance?: number;
  /** Injected clock, so tests are not time-dependent. */
  now?: Date;
  maxAgeMonths?: number;
}

export interface FilterOutcome {
  kept: DvfTransaction[];
  rejected: { reason: string; count: number }[];
}

/** Small accumulator so every drop is counted under exactly one motive. */
class RejectionLedger {
  private readonly counts = new Map<string, number>();

  add(reason: string): void {
    this.counts.set(reason, (this.counts.get(reason) ?? 0) + 1);
  }

  toList(): { reason: string; count: number }[] {
    return [...this.counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }
}

/**
 * Two passes on purpose:
 *  1. hard, per-row rules (typology, nature, lots, surface, age, absolute rails)
 *  2. the IQR fences, computed ONLY on the survivors of pass 1 — computing them
 *     on the raw feed would let the noise we are about to remove widen the
 *     fences that are supposed to remove it.
 */
export function filterCandidates(
  subject: PropertyDraft,
  rows: DvfTransaction[],
  options: FilterOptions = {},
): FilterOutcome {
  const now = options.now ?? new Date();
  const tolerance = options.areaTolerance ?? AREA_TOLERANCE;
  const maxAge = options.maxAgeMonths ?? MAX_AGE_MONTHS;

  const ledger = new RejectionLedger();
  const expectedType = DVF_TYPE_BY_PROPERTY_TYPE[subject.type];
  const basis = areaBasisFor(subject.type);
  const guards = PRICE_PER_SQM_GUARDS[basis];
  const refArea = subjectArea(subject);
  const subjectIsNew = isNewBuildSubject(subject, now);

  // Without a reference surface there is no bracket to test against; the engine
  // refuses the estimate upstream, so here we simply keep nothing.
  if (expectedType === undefined || refArea === undefined) {
    for (const _row of rows) ledger.add(REJECT_REASONS.type);
    return { kept: [], rejected: ledger.toList() };
  }

  const firstPass: { tx: DvfTransaction; pricePerSqm: number }[] = [];

  for (const tx of rows) {
    if (tx.propertyType !== expectedType) {
      ledger.add(REJECT_REASONS.type);
      continue;
    }

    // Nature: only arm's-length sales. Off-plan is judged separately because
    // it is a legitimate comparable for a new-build subject.
    if (tx.nature === "sale_off_plan") {
      if (!subjectIsNew) {
        ledger.add(REJECT_REASONS.offPlan);
        continue;
      }
    } else if (tx.nature === "sale_land_to_build") {
      if (basis !== "land") {
        ledger.add(REJECT_REASONS.nature);
        continue;
      }
    } else if (tx.nature !== "sale") {
      // exchange / auction / expropriation / other: the price does not reflect
      // an open-market negotiation.
      ledger.add(REJECT_REASONS.nature);
      continue;
    }

    if (tx.isMultiLot) {
      ledger.add(REJECT_REASONS.multiLot);
      continue;
    }

    if (!Number.isFinite(tx.price) || tx.price <= 0) {
      ledger.add(REJECT_REASONS.noPrice);
      continue;
    }

    const area = transactionArea(tx, basis);
    if (area === undefined) {
      ledger.add(REJECT_REASONS.noArea);
      continue;
    }

    if (Math.abs(area - refArea) / refArea > tolerance) {
      ledger.add(REJECT_REASONS.areaGap);
      continue;
    }

    if (ageInMonths(tx.date, now) > maxAge) {
      ledger.add(REJECT_REASONS.tooOld);
      continue;
    }

    const pricePerSqm = tx.price / area;
    if (pricePerSqm < guards.min || pricePerSqm > guards.max) {
      ledger.add(REJECT_REASONS.priceGuard);
      continue;
    }

    firstPass.push({ tx, pricePerSqm });
  }

  // Pass 2 — statistical outliers within the surviving sample.
  const bounds = iqrOutlierBounds(
    firstPass.map((r) => r.pricePerSqm),
    IQR_FENCE_K,
  );

  const kept: DvfTransaction[] = [];
  for (const row of firstPass) {
    if (bounds && (row.pricePerSqm < bounds.lower || row.pricePerSqm > bounds.upper)) {
      ledger.add(REJECT_REASONS.priceOutlier);
      continue;
    }
    kept.push(row.tx);
  }

  return { kept, rejected: ledger.toList() };
}

// ---------------------------------------------------------------------------
// Weighting
// ---------------------------------------------------------------------------

export interface ScoreOptions {
  now?: Date;
  /** Pro override, keyed by DVF transaction id. Multiplies the computed weight. */
  manualWeights?: Record<string, number>;
  /** Pro exclusions: kept in the list, weight forced to 0. */
  excludedIds?: string[];
}

/** Highest manual weight a pro may apply, per the `Comparable` contract. */
export const MAX_MANUAL_WEIGHT = 3;

/**
 * Distance sub-score: 1 / (1 + (d/d0)²) — smooth, 1 at the doorstep, 0.5 at d0,
 * never exactly 0 (a far comparable is diluted, not silently deleted).
 * `d0` is half the retained radius, floored at 250 m so a dense 500 m search
 * does not over-punish the far end of its own perimeter.
 */
export function distanceScore(distanceMeters: number, radius: number): number {
  const d0 = Math.max(250, radius / 2);
  const ratio = Math.max(0, distanceMeters) / d0;
  return 1 / (1 + ratio * ratio);
}

/** Exponential decay with an explicit half-life. */
export function recencyScore(ageMonths: number): number {
  if (!Number.isFinite(ageMonths)) return 0;
  return Math.pow(0.5, Math.max(0, ageMonths) / RECENCY_HALF_LIFE_MONTHS);
}

/** 1 for an identical surface, 0.5 at `AREA_SCORE_HALF_GAP` relative gap. */
export function areaScore(candidateArea: number, referenceArea: number): number {
  if (referenceArea <= 0) return 0;
  const relativeGap = Math.abs(candidateArea - referenceArea) / referenceArea;
  const ratio = relativeGap / AREA_SCORE_HALF_GAP;
  return 1 / (1 + ratio * ratio);
}

/**
 * Typology sub-score. The DVF family already matches (the filter guaranteed
 * it), so this only grades the room count.
 *
 * - land and dependencies have no room concept → 1, and we say so.
 * - either side missing → `UNKNOWN_ROOMS_SCORE`, never 1.
 */
export function typeScore(
  subjectRooms: number | undefined,
  candidateRooms: number | undefined,
  basis: AreaBasis,
  dvfType: DvfPropertyType,
): number {
  if (basis === "land" || dvfType === "dependency") return 1;
  if (subjectRooms === undefined || candidateRooms === undefined) return UNKNOWN_ROOMS_SCORE;
  const gap = Math.abs(subjectRooms - candidateRooms);
  return Math.max(MIN_TYPE_SCORE, 1 - 0.18 * gap);
}

/**
 * Turns filtered transactions into weighted comparables.
 *
 * Weights are normalised so the non-excluded ones sum to 1; excluded rows stay
 * in the list with `weight: 0` so a pro can see what was taken out and why.
 */
export function scoreComparables(
  subject: PropertyDraft,
  rows: DvfTransaction[],
  radius: number,
  options: ScoreOptions = {},
): Comparable[] {
  const now = options.now ?? new Date();
  const excluded = new Set(options.excludedIds ?? []);
  const manualWeights = options.manualWeights ?? {};
  const basis = areaBasisFor(subject.type);
  const dvfType = DVF_TYPE_BY_PROPERTY_TYPE[subject.type] ?? "other";
  const refArea = subjectArea(subject) ?? 0;
  const subjectPoint = subject.address.coordinates;

  const draft = rows.map((tx) => {
    const distance = haversineMeters(subjectPoint, tx.coordinates);
    const ageMonths = ageInMonths(tx.date, now);
    const candidateArea = transactionArea(tx, basis) ?? refArea;

    const scores = {
      distance: clamp(distanceScore(distance, radius), 0, 1),
      recency: clamp(recencyScore(ageMonths), 0, 1),
      area: clamp(areaScore(candidateArea, refArea), 0, 1),
      type: clamp(typeScore(subject.features.rooms, tx.rooms, basis, dvfType), 0, 1),
    };

    // Weighted geometric mean of the four sub-scores.
    const raw =
      Math.pow(Math.max(scores.distance, 1e-6), SCORE_EXPONENTS.distance) *
      Math.pow(Math.max(scores.recency, 1e-6), SCORE_EXPONENTS.recency) *
      Math.pow(Math.max(scores.area, 1e-6), SCORE_EXPONENTS.area) *
      Math.pow(Math.max(scores.type, 1e-6), SCORE_EXPONENTS.type);

    const manualRaw = manualWeights[tx.id];
    const manualWeight =
      manualRaw !== undefined && Number.isFinite(manualRaw)
        ? clamp(manualRaw, 0, MAX_MANUAL_WEIGHT)
        : undefined;

    const isExcluded = excluded.has(tx.id);
    const effective = isExcluded ? 0 : raw * (manualWeight ?? 1);

    return {
      transaction: tx,
      distance: Math.round(distance),
      ageMonths: Number.isFinite(ageMonths) ? ageMonths : 0,
      scores,
      weight: 0,
      manualWeight,
      excluded: isExcluded,
      exclusionReason: isExcluded ? "Écarté manuellement" : undefined,
      effective,
    };
  });

  const total = draft.reduce((acc, d) => acc + d.effective, 0);
  const normalised = draft.map((d) => (total > 0 ? d.effective / total : 0));
  const capped = capWeights(normalised, MAX_SINGLE_COMPARABLE_WEIGHT);

  return draft.map(({ effective: _effective, ...comparable }, index) => ({
    ...comparable,
    weight: capped[index] ?? 0,
  }));
}

/**
 * Caps every weight at `cap` and redistributes the excess proportionally over
 * the ones still under it ("water filling"), repeating until stable. The sum is
 * preserved, so the output still adds up to 1.
 *
 * When `n · cap < 1` the constraint is unsatisfiable (two rows cannot both stay
 * under 40 % and still sum to 1). We then leave the vector untouched rather
 * than flatten it: forcing a 50/50 split would throw away the real ordering to
 * satisfy a guard that cannot apply. At those sample sizes it is
 * `MIN_COMPARABLES` — not this cap — that protects the user, and it refuses to
 * publish at all.
 */
export function capWeights(weights: readonly number[], cap: number): number[] {
  const result = [...weights];
  const activeCount = result.filter((w) => w > 0).length;
  if (activeCount === 0 || activeCount * cap < 1) return result;

  const effectiveCap = cap;
  const EPSILON = 1e-12;

  // Bounded loop: each pass pins at least one more row to the cap.
  for (let pass = 0; pass < activeCount + 1; pass += 1) {
    const overIndexes: number[] = [];
    const freeIndexes: number[] = [];
    for (let i = 0; i < result.length; i += 1) {
      const w = result[i] ?? 0;
      if (w > effectiveCap + EPSILON) overIndexes.push(i);
      else if (w > 0) freeIndexes.push(i);
    }
    if (overIndexes.length === 0) break;

    let excess = 0;
    for (const i of overIndexes) {
      excess += (result[i] ?? 0) - effectiveCap;
      result[i] = effectiveCap;
    }

    const freeTotal = freeIndexes.reduce((acc, i) => acc + (result[i] ?? 0), 0);
    if (freeTotal <= 0) break;
    for (const i of freeIndexes) {
      result[i] = (result[i] ?? 0) + (excess * (result[i] ?? 0)) / freeTotal;
    }
  }

  return result;
}
