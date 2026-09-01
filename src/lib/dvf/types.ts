/**
 * Internal DVF types. The public contract lives in `src/types/dvf.ts` and is
 * the only thing that may cross the `src/lib/dvf` boundary.
 */

import type { DvfTransaction } from "@/types/dvf";

/** Why a source line or mutation never made it into the normalised output. */
export type DvfRejectReason =
  | "no_coordinates"
  | "no_price"
  | "no_date"
  | "malformed_row"
  | "unusable_mutation";

export const DVF_REJECT_LABELS: Record<DvfRejectReason, string> = {
  no_coordinates: "Mutation sans coordonnées (non cartographiable)",
  no_price: "Mutation sans valeur foncière",
  no_date: "Mutation sans date exploitable",
  malformed_row: "Ligne CSV incomplète",
  unusable_mutation: "Mutation sans bien identifiable",
};

/**
 * What normalisation actually did. Surfaced by the API so the UI can be
 * honest about coverage rather than pretending the dataset is complete.
 */
export interface DvfNormalizationReport {
  /** Lines read from the source file, header excluded. */
  sourceRows: number;
  /** Distinct `id_mutation` groups found. */
  mutations: number;
  kept: number;
  rejected: { reason: DvfRejectReason; count: number }[];
}

export interface DvfNormalizationResult {
  transactions: DvfTransaction[];
  report: DvfNormalizationReport;
}

/** `code_type_local` in the geo-DVF files. */
export const DVF_LOCAL_TYPE_CODES = {
  house: "1",
  apartment: "2",
  dependency: "3",
  commercial: "4",
} as const;
