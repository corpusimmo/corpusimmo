/**
 * Valuation contracts.
 *
 * The MVP ships one real method (`comparison`). The others are declared here
 * so the UI, the router and the DB can already reason about them.
 */

import type { DvfTransaction } from "./dvf";
import type { PropertyDraft, ProjectIntent } from "./property";

export type ValuationMethodId =
  | "comparison" // implemented
  | "capitalization" // mocked UI
  | "dcf" // mocked UI
  | "replacement_cost"; // future

export type ValuationStatus = "draft" | "computed" | "failed";

/**
 * A DVF transaction promoted to a comparable, with the weighting the engine
 * gave it and — for pros — the manual override applied on top.
 */
export interface Comparable {
  transaction: DvfTransaction;
  /** Metres from the subject property. */
  distance: number;
  /** Whole months between the mutation and today. */
  ageMonths: number;
  /** 0 → 1 sub-scores, kept separate so the UI can explain the weighting. */
  scores: {
    distance: number;
    recency: number;
    area: number;
    type: number;
  };
  /** Normalised final weight within the retained set (sums to 1). */
  weight: number;
  /** Pro override, 0 → 3. `undefined` means "use the computed weight". */
  manualWeight?: number;
  excluded: boolean;
  /** Why the engine dropped it — shown in the pro table. */
  exclusionReason?: string;
  comment?: string;
}

export type ConfidenceLevel = "low" | "moderate" | "high";

export interface ValuationConfidence {
  /** 0 → 100. */
  score: number;
  level: ConfidenceLevel;
  /** Human-readable drivers, already in French, ready to render. */
  factors: { label: string; impact: "positive" | "neutral" | "negative" }[];
}

export interface ValuationRange {
  low: number;
  central: number;
  high: number;
}

/** Everything the result page and the PDF need. Serialisable end to end. */
export interface ValuationResult {
  id: string;
  method: ValuationMethodId;
  status: ValuationStatus;
  createdAt: string;

  subject: PropertyDraft;
  intent?: ProjectIntent;

  /** `undefined` when the engine could not conclude — see `diagnostics`. */
  value?: ValuationRange;
  /** Weighted €/m² retained for the computation. */
  pricePerSqm?: number;
  /** Median €/m² of the retained set, for comparison with the weighted one. */
  medianPricePerSqm?: number;
  averagePricePerSqm?: number;

  confidence: ValuationConfidence;
  comparables: Comparable[];

  /** Audit trail of how we got there — rendered in the "méthodologie" block. */
  diagnostics: {
    /** Radius in metres that finally produced the retained set. */
    radiusUsed: number;
    /** Candidates fetched before filtering. */
    candidatesFound: number;
    /** Rows dropped, by reason. */
    rejected: { reason: string; count: number }[];
    retained: number;
    /** Relative dispersion (IQR / median) of the retained €/m². */
    dispersion?: number;
    yearRange?: [number, number];
    /** Set when the engine bailed out. */
    failureReason?: string;
  };
}

/** Input accepted by `POST /api/estimation` and by the engine directly. */
export interface ValuationRequest {
  subject: PropertyDraft;
  intent?: ProjectIntent;
  /** Pro flow: use exactly these DVF ids instead of an automatic search. */
  comparableIds?: string[];
  /** Pro flow: manual weights keyed by DVF transaction id. */
  manualWeights?: Record<string, number>;
  excludedIds?: string[];
}

/** A pro's basket of hand-picked comparables. */
export interface ComparableSet {
  id: string;
  name?: string;
  propertyId?: string;
  transactionIds: string[];
  createdAt: string;
  updatedAt: string;
}
