/**
 * Comparison-based valuation engine.
 *
 * The method, in one sentence: take real DVF sales close to the subject,
 * discard the ones that are not comparable, weigh the survivors by proximity,
 * recency, surface and typology, and multiply a robust weighted €/m² by the
 * subject's surface.
 *
 * Two commitments run through the whole file:
 * 1. Nothing is invented. When the data cannot support a number, the result
 *    comes back `status: "failed"` with a reason written for a human.
 * 2. Everything is auditable. Every threshold is a named constant, every drop
 *    is counted by motive, every sub-score survives into the output.
 */

import { haversineMeters } from "@/lib/geo/distance";
import { dvfCoverage } from "@/config/site";
import type { DvfPropertyType, DvfProvider, DvfTransaction } from "@/types/dvf";
import { DvfProviderError } from "@/types/dvf";
import type { PropertyDraft, PropertyType } from "@/types/property";
import type { ValuationRequest, ValuationResult, ValuationRange } from "@/types/valuation";
import {
  AREA_TOLERANCE,
  AREA_TOLERANCE_RELAXED,
  DVF_TYPE_BY_PROPERTY_TYPE,
  MIN_COMPARABLES,
  REJECT_REASONS,
  SEARCH_RADII_METERS,
  TARGET_COMPARABLES,
  areaBasisFor,
  filterCandidates,
  scoreComparables,
  subjectArea,
  transactionPricePerSqm,
} from "./comparables";
import { computeConfidence, failedConfidence } from "./confidence";
import {
  clamp,
  mean,
  median,
  relativeIqr,
  weightedMean,
  weightedQuantile,
  winsorize,
} from "./stats";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Rows requested per radius. Generous: the filters do the real narrowing. */
export const CANDIDATE_FETCH_LIMIT = 500;

/**
 * Above this many raw candidates inside the first radius, the market is dense
 * enough that widening would trade locality for volume. We stop as soon as the
 * minimum is met instead of chasing the target.
 */
export const DENSE_MARKET_CANDIDATES = 120;

/**
 * Range width. Half-width = base + dispersion + scarcity + staleness, clamped.
 * The point is that the bracket is a property of the DATA, not a decorative
 * ±8 %: a tight, recent, abundant sample earns a narrow range and a scattered
 * one is honestly reported as wide.
 */
export const RANGE = {
  /** Irreducible uncertainty: DVF ignores condition, view, floor plan, DPE. */
  base: 0.03,
  /** Multiplier on the relative IQR of the retained €/m². */
  dispersionFactor: 0.5,
  /** Penalty for a thin sample, fading out at `countSaturation` comparables. */
  countFactor: 0.09,
  countSaturation: 15,
  /** Penalty for an old sample, maxed out at `MAX_AGE_MONTHS`. */
  ageFactor: 0.04,
  ageSaturationMonths: 60,
  /** Used when dispersion is not computable — an unknown is not good news. */
  unknownDispersion: 0.25,
  /** Never pretend to be more precise than this. */
  minHalfWidth: 0.05,
  /** Beyond this a range stops informing anyone. */
  maxHalfWidth: 0.22,
} as const;

/**
 * Total cap on the qualitative adjustments. DVF publishes neither condition nor
 * floor nor outdoor space, so we correct for them — but a correction we cannot
 * verify must stay small. ±12 % is roughly one notch of condition plus one
 * amenity; beyond that we would be guessing louder than we know.
 */
export const MAX_TOTAL_ADJUSTMENT = 0.12;

/**
 * If the winsorised weighted mean and the weighted median disagree by more
 * than this, the distribution is too skewed for any mean and we keep the
 * median.
 */
export const MEAN_MEDIAN_DIVERGENCE_GUARD = 0.25;

// ---------------------------------------------------------------------------
// Public options
// ---------------------------------------------------------------------------

/**
 * Asset families DVF measures badly.
 *
 * DVF records SALES only, and a large share of commercial/tertiary deals change
 * hands through a transfer of company shares, which never appears as a mutation.
 * We still estimate when there is material, but the result must carry the
 * caveat rather than pretend the sample is representative.
 */
export const POORLY_COVERED_TYPES: readonly PropertyType[] = [
  "office",
  "retail",
  "business_premises",
  "building",
];

export function isPoorlyCoveredByDvf(type: PropertyType): boolean {
  return POORLY_COVERED_TYPES.includes(type);
}

/** Single wording for the regulatory sample floor, used by both checkpoints. */
function insufficientSampleReason(count: number): string {
  return `Pas assez de ventes comparables autour de cette adresse pour produire une estimation fiable : ${count} ${count > 1 ? "ventes exploitables" : "vente exploitable"} seulement, alors que nous en exigeons ${MIN_COMPARABLES} au minimum. Publier un prix sur un échantillon aussi réduit reviendrait à republier ces quelques ventes plutôt qu'à estimer un marché.`;
}

export interface EstimateOptions {
  /** Injected DVF provider — tests use it to stay off the network. */
  provider?: DvfProvider;
  /** Injected clock, so ages are deterministic in tests. */
  now?: Date;
  /** Injected id, so snapshots are stable. */
  id?: string;
}

export interface ValuationAdjustment {
  label: string;
  /** Signed relative correction, e.g. `-0.04` for −4 %. */
  ratio: number;
}

export interface AdjustmentOutcome {
  items: ValuationAdjustment[];
  /** Sum of the items, clamped to ±`MAX_TOTAL_ADJUSTMENT`. */
  total: number;
  /** True when the clamp actually bit. */
  capped: boolean;
}

// ---------------------------------------------------------------------------
// Qualitative adjustments
// ---------------------------------------------------------------------------

/**
 * Corrections for what DVF does NOT carry in its €/m².
 *
 * Deliberately excluded: anything already priced into the comparables. A house
 * garden is not a bonus when every comparable house has one; a plot's own
 * surface is already the denominator for land.
 */
export function computeAdjustments(subject: PropertyDraft): AdjustmentOutcome {
  const items: ValuationAdjustment[] = [];
  const { type, features } = subject;

  // Land is valued per m² of plot; state, floor and outdoor space are moot.
  if (type === "land") return { items, total: 0, capped: false };

  switch (features.condition) {
    case "to_renovate":
      items.push({ label: "Bien à rénover", ratio: -0.08 });
      break;
    case "refresh_needed":
      items.push({ label: "Travaux de rafraîchissement à prévoir", ratio: -0.04 });
      break;
    case "very_good":
      items.push({ label: "Très bon état déclaré", ratio: 0.03 });
      break;
    case "new":
      items.push({ label: "Bien neuf ou récent", ratio: 0.06 });
      break;
    default:
      // "good" and unknown are the implicit baseline of the comparables.
      break;
  }

  if (type === "apartment") {
    const { floor, hasElevator } = features;
    if (floor !== undefined) {
      if (floor === 0) {
        items.push({ label: "Rez-de-chaussée", ratio: -0.03 });
      } else if (floor >= 3 && hasElevator === false) {
        items.push({ label: "Étage élevé sans ascenseur", ratio: -0.04 });
      } else if (floor >= 3 && hasElevator === true) {
        items.push({ label: "Étage élevé avec ascenseur", ratio: 0.02 });
      }
    }
  }

  switch (features.outdoor) {
    case "terrace":
      items.push({ label: "Terrasse", ratio: 0.03 });
      break;
    case "balcony":
      items.push({ label: "Balcon", ratio: 0.015 });
      break;
    case "garden":
      // Only remarkable for a flat: comparable houses almost all have one.
      if (type === "apartment") items.push({ label: "Jardin privatif", ratio: 0.04 });
      break;
    default:
      break;
  }

  if (features.hasGarage) {
    items.push({ label: "Garage", ratio: 0.025 });
  } else if (features.hasParking) {
    items.push({ label: "Stationnement", ratio: 0.02 });
  }

  const raw = items.reduce((acc, i) => acc + i.ratio, 0);
  const total = clamp(raw, -MAX_TOTAL_ADJUSTMENT, MAX_TOTAL_ADJUSTMENT);
  return { items, total, capped: Math.abs(raw) > MAX_TOTAL_ADJUSTMENT + 1e-9 };
}

// ---------------------------------------------------------------------------
// Range
// ---------------------------------------------------------------------------

export function rangeHalfWidth(input: {
  dispersion?: number;
  comparableCount: number;
  averageAgeMonths: number;
}): number {
  const dispersion = input.dispersion ?? RANGE.unknownDispersion;
  const scarcity =
    RANGE.countFactor * (1 - Math.min(1, input.comparableCount / RANGE.countSaturation));
  const staleness =
    RANGE.ageFactor * Math.min(1, Math.max(0, input.averageAgeMonths) / RANGE.ageSaturationMonths);

  return clamp(
    RANGE.base + RANGE.dispersionFactor * Math.max(0, dispersion) + scarcity + staleness,
    RANGE.minHalfWidth,
    RANGE.maxHalfWidth,
  );
}

/** Rounds to a step a human would quote, so we do not fake 3 214 € of precision. */
function roundingStep(value: number): number {
  if (value >= 500_000) return 5_000;
  if (value >= 100_000) return 1_000;
  if (value >= 20_000) return 500;
  return 100;
}

function buildRange(central: number, halfWidth: number): ValuationRange {
  const step = roundingStep(central);
  const round = (v: number) => Math.round(v / step) * step;

  const roundedCentral = Math.max(step, round(central));
  let low = round(central * (1 - halfWidth));
  let high = round(central * (1 + halfWidth));

  // Rounding must never collapse the bracket onto the central value.
  if (low >= roundedCentral) low = roundedCentral - step;
  if (high <= roundedCentral) high = roundedCentral + step;

  return { low: Math.max(step, low), central: roundedCentral, high };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface SearchAttempt {
  radius: number;
  fetched: number;
  outOfRadius: number;
  kept: DvfTransaction[];
  rejected: { reason: string; count: number }[];
  relaxed: boolean;
}

export async function estimateByComparison(
  req: ValuationRequest,
  options: EstimateOptions = {},
): Promise<ValuationResult> {
  const now = options.now ?? new Date();
  const id = options.id ?? newId();
  const subject = req.subject;

  const fail = (failureReason: string, radiusUsed = 0): ValuationResult => ({
    id,
    method: "comparison",
    status: "failed",
    createdAt: now.toISOString(),
    subject,
    intent: req.intent,
    confidence: failedConfidence(failureReason),
    comparables: [],
    diagnostics: {
      radiusUsed,
      candidatesFound: 0,
      rejected: [],
      retained: 0,
      failureReason,
    },
  });

  // --- Pre-flight: can we even attempt this? --------------------------------
  const dvfType = DVF_TYPE_BY_PROPERTY_TYPE[subject.type];
  if (dvfType === undefined) {
    return fail(
      "Les données DVF ne distinguent pas ce type de bien : la méthode par comparaison ne peut pas s'appliquer. Un immeuble se valorise lot par lot, un bien atypique nécessite l'avis d'un professionnel.",
    );
  }

  const basis = areaBasisFor(subject.type);
  const refArea = subjectArea(subject);
  if (refArea === undefined) {
    return fail(
      basis === "land"
        ? "La surface du terrain est nécessaire pour calculer une estimation. Merci de la renseigner."
        : "La surface habitable est nécessaire pour calculer une estimation. Merci de la renseigner.",
    );
  }

  const point = subject.address.coordinates;
  if (
    !point ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    (point.lat === 0 && point.lng === 0)
  ) {
    return fail(
      "L'adresse n'a pas pu être localisée précisément. Sélectionnez une adresse dans la liste de suggestions pour lancer le calcul.",
    );
  }

  if ((dvfCoverage.excludedDepartments as readonly string[]).includes(subject.address.departmentCode)) {
    return fail(
      `Les ventes de ce département ne sont pas publiées dans DVF (${dvfCoverage.excludedLabel}). Nous ne pouvons pas produire d'estimation à partir de transactions réelles ici.`,
    );
  }

  let provider: DvfProvider;
  try {
    provider = await resolveProvider(options.provider);
  } catch {
    return fail(
      "La source de données DVF n'est pas disponible actuellement. Réessayez dans quelques instants.",
    );
  }

  // --- Candidate gathering --------------------------------------------------
  let attempt: SearchAttempt;
  let manualSelection = false;

  try {
    if (req.comparableIds && req.comparableIds.length > 0) {
      manualSelection = true;
      attempt = await gatherExplicitComparables(provider, req.comparableIds, point);
    } else {
      const searched = await runRadiusSearch(provider, subject, dvfType, point, now);
      if (!searched) {
        return fail(
          `Aucune vente comparable exploitable n'a été trouvée jusqu'à ${SEARCH_RADII_METERS[SEARCH_RADII_METERS.length - 1] ?? 5000} m autour de cette adresse. Le secteur est trop peu actif, ou le bien est trop atypique pour la méthode par comparaison.`,
          SEARCH_RADII_METERS[SEARCH_RADII_METERS.length - 1] ?? 5000,
        );
      }
      attempt = searched;
    }
  } catch (error) {
    const message =
      error instanceof DvfProviderError
        ? "La source de données DVF est momentanément indisponible. Aucune estimation n'a été calculée."
        : "Une erreur est survenue pendant la récupération des ventes DVF. Aucune estimation n'a été calculée.";
    return fail(message);
  }

  if (attempt.kept.length === 0) {
    return fail(
      manualSelection
        ? "Aucune des mutations sélectionnées n'a pu être récupérée dans DVF."
        : "Aucune vente comparable exploitable n'a été retenue autour de cette adresse.",
      attempt.radius,
    );
  }

  // Regulatory floor — applies to the pro basket exactly as it applies to the
  // automatic search. A hand-picked selection of three sales is still three
  // sales.
  if (attempt.kept.length < MIN_COMPARABLES) {
    return fail(insufficientSampleReason(attempt.kept.length), attempt.radius);
  }

  // --- Weighting ------------------------------------------------------------
  // Rows whose €/m² is not computable cannot feed the average; on the pro path
  // they are kept visible but neutralised rather than silently dropped.
  const unusable = attempt.kept
    .filter((tx) => transactionPricePerSqm(tx, basis) === undefined)
    .map((tx) => tx.id);

  const comparables = scoreComparables(subject, attempt.kept, attempt.radius, {
    now,
    manualWeights: req.manualWeights,
    excludedIds: [...(req.excludedIds ?? []), ...unusable],
  }).map((c) =>
    unusable.includes(c.transaction.id)
      ? { ...c, exclusionReason: REJECT_REASONS.noArea }
      : c,
  );

  const active = comparables.filter((c) => !c.excluded && c.weight > 0);
  if (active.length === 0) {
    return fail(
      "Tous les comparables ont été écartés : il ne reste aucune vente pour asseoir le calcul.",
      attempt.radius,
    );
  }

  // The floor is about what actually feeds the number, so it is re-checked
  // after manual exclusions and after rows with no usable surface are dropped.
  if (active.length < MIN_COMPARABLES) {
    return fail(insufficientSampleReason(active.length), attempt.radius);
  }

  // --- Central €/m² ---------------------------------------------------------
  const pairs = active
    .map((c) => ({ value: transactionPricePerSqm(c.transaction, basis), weight: c.weight }))
    .filter((p): p is { value: number; weight: number } => p.value !== undefined);

  const values = pairs.map((p) => p.value);
  const pricePerSqm = robustCentralPricePerSqm(pairs);
  if (pricePerSqm === undefined) {
    return fail(
      "Le prix au m² n'a pas pu être calculé sur les ventes retenues.",
      attempt.radius,
    );
  }

  const dispersion = relativeIqr(values);
  const averageAgeMonths = mean(active.map((c) => c.ageMonths)) ?? 0;
  const averageDistance = mean(active.map((c) => c.distance)) ?? 0;

  // --- Value ----------------------------------------------------------------
  const adjustments = computeAdjustments(subject);
  const rawCentral = refArea * pricePerSqm * (1 + adjustments.total);
  const halfWidth = rangeHalfWidth({
    dispersion,
    comparableCount: active.length,
    averageAgeMonths,
  });
  const value = buildRange(rawCentral, halfWidth);

  const years = active.map((c) => c.transaction.year).filter((y) => Number.isFinite(y));
  const minYear = years.length > 0 ? Math.min(...years) : undefined;
  const maxYear = years.length > 0 ? Math.max(...years) : undefined;

  return {
    id,
    method: "comparison",
    status: "computed",
    createdAt: now.toISOString(),
    subject,
    intent: req.intent,
    value,
    pricePerSqm: Math.round(pricePerSqm),
    medianPricePerSqm: roundOrUndefined(median(values)),
    averagePricePerSqm: roundOrUndefined(mean(values)),
    confidence: computeConfidence({
      comparableCount: active.length,
      dispersion,
      averageAgeMonths,
      averageDistanceMeters: averageDistance,
      radiusUsed: attempt.radius,
      relaxedAreaTolerance: attempt.relaxed,
      poorlyCoveredByDvf: isPoorlyCoveredByDvf(subject.type),
    }),
    comparables,
    diagnostics: {
      radiusUsed: attempt.radius,
      candidatesFound: attempt.fetched,
      rejected: [
        ...attempt.rejected,
        ...(attempt.outOfRadius > 0
          ? [{ reason: REJECT_REASONS.outOfRadius, count: attempt.outOfRadius }]
          : []),
      ],
      // What the arithmetic actually used, exclusions included.
      retained: active.length,
      dispersion,
      yearRange: minYear !== undefined && maxYear !== undefined ? [minYear, maxYear] : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Winsorised weighted mean, cross-checked against the weighted median.
 *
 * Why not a plain average: one survivor of the IQR filter is enough to move it.
 * Why not the weighted median alone: on eight comparables it degenerates into
 * "pick one sale", throwing away the seven others.
 * Winsorising at the deciles keeps every sale's weight while capping the tails,
 * and the median guard catches the residual case where the shape is so skewed
 * that no mean is defensible.
 */
export function robustCentralPricePerSqm(
  pairs: readonly { value: number; weight: number }[],
): number | undefined {
  if (pairs.length === 0) return undefined;

  const capped = winsorize(pairs.map((p) => p.value), 0.1, 0.9);
  const winsorisedPairs = capped.map((value, i) => ({
    value,
    weight: pairs[i]?.weight ?? 0,
  }));

  const weightedAverage = weightedMean(winsorisedPairs);
  const weightedMedian = weightedQuantile(pairs, 0.5);

  if (weightedAverage === undefined) return weightedMedian;
  if (weightedMedian === undefined || weightedMedian <= 0) return weightedAverage;

  const divergence = Math.abs(weightedAverage - weightedMedian) / weightedMedian;
  return divergence > MEAN_MEDIAN_DIVERGENCE_GUARD ? weightedMedian : weightedAverage;
}

async function resolveProvider(injected?: DvfProvider): Promise<DvfProvider> {
  if (injected) return injected;
  // Lazy on purpose: the engine must stay unit-testable without the DVF layer.
  const mod = await import("@/lib/dvf");
  return mod.getDvfProvider();
}

/**
 * Pro path: exactly the ids the professional picked, no automatic search and
 * no statistical filtering — the human made the selection and owns it.
 */
async function gatherExplicitComparables(
  provider: DvfProvider,
  ids: string[],
  point: { lat: number; lng: number },
): Promise<SearchAttempt> {
  const fetched = await Promise.all(ids.map((id) => provider.getTransactionById(id)));
  const kept = fetched.filter((tx): tx is DvfTransaction => tx !== null);

  // The radius only calibrates the distance decay here; take the furthest pick.
  const maxDistance = kept.reduce(
    (acc, tx) => Math.max(acc, haversineMeters(point, tx.coordinates)),
    0,
  );

  return {
    radius: Math.max(SEARCH_RADII_METERS[0] ?? 500, Math.round(maxDistance)),
    fetched: ids.length,
    outOfRadius: 0,
    kept,
    rejected:
      ids.length > kept.length
        ? [{ reason: "Mutation introuvable dans DVF", count: ids.length - kept.length }]
        : [],
    relaxed: false,
  };
}

/**
 * Consumer path: 500 m → 1 → 2 → 5 km, stopping at the first radius that
 * yields `TARGET_COMPARABLES`. Within a radius we first try the strict surface
 * bracket and only widen it when the strict one starves the sample.
 */
async function runRadiusSearch(
  provider: DvfProvider,
  subject: PropertyDraft,
  dvfType: DvfPropertyType,
  point: { lat: number; lng: number },
  now: Date,
): Promise<SearchAttempt | null> {
  let best: SearchAttempt | null = null;

  for (const [index, radius] of SEARCH_RADII_METERS.entries()) {
    const result = await provider.getTransactionsNearPoint({
      center: point,
      radius,
      propertyTypes: [dvfType],
      limit: CANDIDATE_FETCH_LIMIT,
    });

    const rows = result.transactions;
    const within = rows.filter((tx) => haversineMeters(point, tx.coordinates) <= radius);
    const outOfRadius = rows.length - within.length;

    for (const relaxed of [false, true]) {
      const outcome = filterCandidates(subject, within, {
        now,
        areaTolerance: relaxed ? AREA_TOLERANCE_RELAXED : AREA_TOLERANCE,
      });

      const attempt: SearchAttempt = {
        radius,
        fetched: rows.length,
        outOfRadius,
        kept: outcome.kept,
        rejected: outcome.rejected,
        relaxed,
      };

      if (best === null || attempt.kept.length > best.kept.length) best = attempt;

      if (attempt.kept.length >= TARGET_COMPARABLES) return attempt;

      // Dense market: plenty of local evidence already, widening would only
      // trade locality for volume.
      if (
        index === 0 &&
        rows.length >= DENSE_MARKET_CANDIDATES &&
        attempt.kept.length >= MIN_COMPARABLES
      ) {
        return attempt;
      }
    }
  }

  // Nothing reached the target: hand back the richest attempt and let the
  // caller decide whether it clears the minimum.
  return best;
}

function roundOrUndefined(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}

function newId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `val_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
