/**
 * Normalised DVF (Demandes de Valeurs Foncières) contracts.
 *
 * Everything downstream — map, comparables, valuation engine — speaks this
 * shape. Provider-specific field names never leak past `src/lib/dvf/providers`.
 *
 * DATA HONESTY RULE (see /docs/dvf.md):
 * a field is `undefined` when the open data does not carry it. We never
 * substitute a guess. Anything we compute ourselves is flagged as such.
 */

import type { BBox, LatLng } from "./geo";

/** Property families DVF can actually distinguish. Nothing invented. */
export type DvfPropertyType =
  | "apartment"
  | "house"
  | "land"
  | "commercial" // "Local industriel. commercial ou assimilé"
  | "dependency" // garages, cellars, outbuildings
  | "other";

/** `nature_mutation` in the source data. */
export type DvfMutationNature =
  | "sale" // Vente
  | "sale_off_plan" // Vente en l'état futur d'achèvement
  | "sale_land_to_build" // Vente terrain à bâtir
  | "exchange" // Échange
  | "auction" // Adjudication
  | "expropriation"
  | "other";

/**
 * One normalised DVF mutation (a recorded sale).
 *
 * `pricePerSqm` is the only derived field kept inline because every consumer
 * needs it; it is `undefined` whenever the surface is missing or absurd.
 */
export interface DvfTransaction {
  /** Stable, provider-prefixed id. e.g. `geodvf:2024-532458`. */
  id: string;
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  year: number;
  nature: DvfMutationNature;
  /** Total consideration of the mutation, in euros. Never null in output. */
  price: number;
  propertyType: DvfPropertyType;
  /** Raw `type_local` label, kept for display honesty. */
  propertyTypeLabel?: string;

  /** Built surface in m² — absent for land and for some mutations. */
  builtArea?: number;
  /** Plot surface in m². */
  landArea?: number;
  /** `nombre_pieces_principales`. Absent ≠ zero. */
  rooms?: number;

  /** Street-level label. Number is present only when the source has it. */
  addressLabel?: string;
  postcode?: string;
  city: string;
  /** INSEE code. */
  cityCode: string;
  departmentCode: string;

  coordinates: LatLng;

  /** DERIVED: price / builtArea, rounded. Undefined when not computable. */
  pricePerSqm?: number;

  /**
   * True when the mutation bundles several lots/parcels, which makes the
   * unit price unreliable. Consumers should down-weight or hide these.
   */
  isMultiLot: boolean;
  lotCount?: number;

  /** Which provider produced this row — surfaced in the UI for traceability. */
  source: DvfSourceId;
}

export type DvfSourceId = "geodvf" | "cerema" | "mock";

export interface DvfQueryFilters {
  propertyTypes?: DvfPropertyType[];
  /** Inclusive year bounds. */
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  pricePerSqmMin?: number;
  pricePerSqmMax?: number;
  /** Hard cap on returned rows; providers must honour it. */
  limit?: number;
}

export interface DvfBoundsQuery extends DvfQueryFilters {
  bbox: BBox;
}

export interface DvfRadiusQuery extends DvfQueryFilters {
  center: LatLng;
  /** Metres. */
  radius: number;
}

/** What the API returns alongside the rows so the UI can be honest. */
export interface DvfResult {
  transactions: DvfTransaction[];
  /** Rows actually returned after the provider-side cap. */
  count: number;
  /** True when `limit` truncated the result — the UI must say so. */
  truncated: boolean;
  source: DvfSourceId;
  /** Communes actually consulted, so the UI can show coverage. */
  communes: string[];
  /** Most recent mutation year present in the dataset consulted. */
  latestYear?: number;
}

/**
 * The provider contract. Swapping Etalab for Cerema (or a warehouse later)
 * must not touch a single component.
 */
export interface DvfProvider {
  readonly id: DvfSourceId;
  readonly label: string;
  getTransactionsByBounds(query: DvfBoundsQuery): Promise<DvfResult>;
  getTransactionsNearPoint(query: DvfRadiusQuery): Promise<DvfResult>;
  getTransactionById(id: string): Promise<DvfTransaction | null>;
}

/** Thrown by providers so routes can map failure to a truthful UI state. */
export class DvfProviderError extends Error {
  constructor(
    message: string,
    readonly cause_?: unknown,
    readonly status = 502,
  ) {
    super(message);
    this.name = "DvfProviderError";
  }
}
