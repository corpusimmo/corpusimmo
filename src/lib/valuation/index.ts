/**
 * Public surface of the valuation engine.
 *
 * Consumers (routes, result page, PDF, pro workspace) import from here only —
 * the internal file split is free to change as long as this stays stable.
 */

export {
  estimateByComparison,
  computeAdjustments,
  rangeHalfWidth,
  robustCentralPricePerSqm,
  isPoorlyCoveredByDvf,
  MAX_TOTAL_ADJUSTMENT,
  POORLY_COVERED_TYPES,
  RANGE,
  type EstimateOptions,
  type ValuationAdjustment,
  type AdjustmentOutcome,
} from "./engine";

export {
  filterCandidates,
  scoreComparables,
  capWeights,
  MAX_SINGLE_COMPARABLE_WEIGHT,
  areaBasisFor,
  subjectArea,
  transactionArea,
  transactionPricePerSqm,
  REJECT_REASONS,
  SEARCH_RADII_METERS,
  TARGET_COMPARABLES,
  MIN_COMPARABLES,
  MAX_AGE_MONTHS,
  AREA_TOLERANCE,
  AREA_TOLERANCE_RELAXED,
  RECENCY_HALF_LIFE_MONTHS,
  PRICE_PER_SQM_GUARDS,
  DVF_TYPE_BY_PROPERTY_TYPE,
  type AreaBasis,
  type FilterOutcome,
  type ScoreOptions,
} from "./comparables";

export {
  computeConfidence,
  failedConfidence,
  levelForScore,
  CONFIDENCE_WEIGHTS,
  CONFIDENCE_CAPS,
  type ConfidenceInput,
} from "./confidence";

export { explainValuation } from "./explain";

export {
  median,
  quantile,
  weightedMean,
  weightedQuantile,
  iqrOutlierBounds,
  relativeIqr,
  winsorize,
  mean,
  clamp,
} from "./stats";

export {
  parseValuationRequest,
  valuationRequestSchema,
  projectIntentSchema,
  propertyDraftSchema,
  type ParseOutcome,
  type ValidationIssue,
} from "./request-schema";

export { parseValuationResult, valuationResultSchema } from "./result-schema";
