/**
 * Confidence score.
 *
 * This number tells a user how much to trust the estimate, so it must be hard
 * to inflate. Four additive components (100 points total), then a set of hard
 * caps that no combination of the components can override: a thin or scattered
 * sample can never be sold as "confiance élevée".
 */

import { formatDistance, formatPercent, formatRelativeMonths } from "@/lib/utils/format";
import type { ConfidenceLevel, ValuationConfidence } from "@/types/valuation";
import { clamp } from "./stats";

/** Component ceilings — they sum to 100. */
export const CONFIDENCE_WEIGHTS = {
  /** How many comparable sales survived the filters. */
  sample: 35,
  /** How homogeneous their €/m² are. */
  dispersion: 30,
  /** How recent they are. */
  recency: 20,
  /** How close they are. */
  proximity: 15,
} as const;

/** Sample size at which the `sample` component saturates. */
export const SAMPLE_SATURATION = 16;
/** Dispersion (IQR/median) considered excellent / unusable. */
export const DISPERSION_FLOOR = 0.08;
export const DISPERSION_CEILING = 0.4;
/** Average age at which the recency component hits zero. */
export const RECENCY_ZERO_MONTHS = 48;
/** Average distance at which the proximity component hits zero. */
export const PROXIMITY_ZERO_METERS = 2_000;

export const LEVEL_THRESHOLDS = { high: 70, moderate: 45 } as const;

/**
 * Hard ceilings. These exist so the arithmetic can never produce a reassuring
 * score on a sample that does not deserve one.
 */
export const CONFIDENCE_CAPS = {
  /** Fewer than 6 retained sales: "moderate" at best. */
  thinSample: { threshold: 6, cap: 55 },
  /** Prices all over the place: "moderate" at best. */
  highDispersion: { threshold: 0.35, cap: 55 },
  /** Sample averaging more than 3.5 years old. */
  staleSample: { threshold: 42, cap: 65 },
  /**
   * Commercial / tertiary assets: DVF only sees asset deals, not the share
   * transfers a large part of that market actually uses. Whatever the sample
   * looks like, we cannot claim high confidence on it.
   */
  poorlyCovered: { cap: 60 },
} as const;

export interface ConfidenceInput {
  comparableCount: number;
  /** Relative IQR of the retained €/m². `undefined` when not computable. */
  dispersion?: number;
  averageAgeMonths: number;
  averageDistanceMeters: number;
  radiusUsed: number;
  /** True when the surface bracket had to be widened to find enough sales. */
  relaxedAreaTolerance?: boolean;
  /**
   * True for offices, retail, business premises and whole buildings — market
   * segments DVF captures partially at best.
   */
  poorlyCoveredByDvf?: boolean;
}

export function levelForScore(score: number): ConfidenceLevel {
  if (score >= LEVEL_THRESHOLDS.high) return "high";
  if (score >= LEVEL_THRESHOLDS.moderate) return "moderate";
  return "low";
}

export function computeConfidence(input: ConfidenceInput): ValuationConfidence {
  const {
    comparableCount,
    dispersion,
    averageAgeMonths,
    averageDistanceMeters,
    poorlyCoveredByDvf,
  } = input;

  // --- Components -----------------------------------------------------------
  // sqrt so that the first comparables count more than the sixteenth: going
  // from 4 to 8 sales matters far more than going from 20 to 24.
  const sampleScore =
    CONFIDENCE_WEIGHTS.sample * clamp(Math.sqrt(comparableCount / SAMPLE_SATURATION), 0, 1);

  // No dispersion figure means we could not measure homogeneity: we award half
  // the component, not the full one.
  const dispersionScore =
    dispersion === undefined
      ? CONFIDENCE_WEIGHTS.dispersion * 0.5
      : CONFIDENCE_WEIGHTS.dispersion *
        clamp(
          1 - (dispersion - DISPERSION_FLOOR) / (DISPERSION_CEILING - DISPERSION_FLOOR),
          0,
          1,
        );

  const recencyScore =
    CONFIDENCE_WEIGHTS.recency * clamp(1 - averageAgeMonths / RECENCY_ZERO_MONTHS, 0, 1);

  const proximityScore =
    CONFIDENCE_WEIGHTS.proximity *
    clamp(1 - averageDistanceMeters / PROXIMITY_ZERO_METERS, 0, 1);

  let score = sampleScore + dispersionScore + recencyScore + proximityScore;

  // --- Caps -----------------------------------------------------------------
  if (comparableCount < CONFIDENCE_CAPS.thinSample.threshold) {
    score = Math.min(score, CONFIDENCE_CAPS.thinSample.cap);
  }
  if (dispersion !== undefined && dispersion > CONFIDENCE_CAPS.highDispersion.threshold) {
    score = Math.min(score, CONFIDENCE_CAPS.highDispersion.cap);
  }
  if (averageAgeMonths > CONFIDENCE_CAPS.staleSample.threshold) {
    score = Math.min(score, CONFIDENCE_CAPS.staleSample.cap);
  }
  if (poorlyCoveredByDvf) {
    score = Math.min(score, CONFIDENCE_CAPS.poorlyCovered.cap);
  }

  const rounded = Math.round(clamp(score, 0, 100));

  return {
    score: rounded,
    level: levelForScore(rounded),
    factors: buildFactors(input),
  };
}

/** Confidence object used when the engine could not conclude at all. */
export function failedConfidence(reason: string): ValuationConfidence {
  return {
    score: 0,
    level: "low",
    factors: [{ label: reason, impact: "negative" }],
  };
}

function buildFactors(input: ConfidenceInput): ValuationConfidence["factors"] {
  const factors: ValuationConfidence["factors"] = [];
  const {
    comparableCount,
    dispersion,
    averageAgeMonths,
    averageDistanceMeters,
    radiusUsed,
    relaxedAreaTolerance,
    poorlyCoveredByDvf,
  } = input;

  const radiusLabel = formatDistance(radiusUsed);

  if (comparableCount >= 12) {
    factors.push({
      label: `${comparableCount} ventes comparables retenues dans un rayon de ${radiusLabel}`,
      impact: "positive",
    });
  } else if (comparableCount >= 8) {
    factors.push({
      label: `${comparableCount} ventes comparables retenues dans un rayon de ${radiusLabel}`,
      impact: "neutral",
    });
  } else {
    factors.push({
      label: `Seulement ${comparableCount} ventes comparables exploitables dans un rayon de ${radiusLabel}`,
      impact: "negative",
    });
  }

  if (dispersion === undefined) {
    factors.push({
      label: "Dispersion des prix non mesurable sur un échantillon aussi réduit",
      impact: "negative",
    });
  } else if (dispersion <= 0.15) {
    factors.push({
      label: `Prix au m² homogènes dans le secteur (écart interquartile de ${formatPercent(dispersion * 100, 0)})`,
      impact: "positive",
    });
  } else if (dispersion <= 0.3) {
    factors.push({
      label: `Dispersion des prix modérée dans le secteur (${formatPercent(dispersion * 100, 0)})`,
      impact: "neutral",
    });
  } else {
    factors.push({
      label: `Dispersion des prix élevée dans le secteur (${formatPercent(dispersion * 100, 0)})`,
      impact: "negative",
    });
  }

  const roundedAge = Math.round(averageAgeMonths);
  if (roundedAge <= 18) {
    factors.push({
      label: `Ventes récentes (${formatRelativeMonths(roundedAge)} en moyenne)`,
      impact: "positive",
    });
  } else if (roundedAge <= 36) {
    factors.push({
      label: `Ventes datant en moyenne de ${roundedAge} mois`,
      impact: "neutral",
    });
  } else {
    factors.push({
      label: `Ventes anciennes : plus de 3 ans en moyenne (${roundedAge} mois)`,
      impact: "negative",
    });
  }

  if (averageDistanceMeters <= 600) {
    factors.push({
      label: `Comparables très proches (${formatDistance(averageDistanceMeters)} en moyenne)`,
      impact: "positive",
    });
  } else if (averageDistanceMeters <= 1_500) {
    factors.push({
      label: `Comparables situés à ${formatDistance(averageDistanceMeters)} en moyenne`,
      impact: "neutral",
    });
  } else {
    factors.push({
      label: `Comparables éloignés (${formatDistance(averageDistanceMeters)} en moyenne)`,
      impact: "negative",
    });
  }

  if (relaxedAreaTolerance) {
    factors.push({
      label: "Fourchette de surface élargie faute de biens de taille équivalente",
      impact: "negative",
    });
  }

  if (poorlyCoveredByDvf) {
    factors.push({
      label:
        "Immobilier d'entreprise mal couvert par DVF : une grande partie de ces transactions passe par une cession de parts de société et n'y figure pas",
      impact: "negative",
    });
  }

  return factors;
}
