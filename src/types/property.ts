/**
 * `Property` is the spine of the product.
 *
 * A pro should never retype the same building twice: the estimator, the
 * comparables basket, the valuation methods and the documents all read and
 * write the same object.
 */

import type { GeoAddress, LatLng } from "./geo";

export type PropertyType =
  | "apartment"
  | "house"
  | "land"
  | "building" // immeuble
  | "parking"
  | "retail" // commerce
  | "office"
  | "business_premises" // local professionnel / activité
  | "other";

/** How the asset is used — orthogonal to who owns it. */
export type PropertyUsage = "residential" | "commercial" | "mixed" | "land";

export type PropertyCondition =
  | "to_renovate"
  | "refresh_needed"
  | "good"
  | "very_good"
  | "new";

export type OutdoorFeature = "balcony" | "terrace" | "garden" | "none";

export interface PropertyAddress {
  label: string;
  houseNumber?: string;
  street?: string;
  postcode?: string;
  city: string;
  cityCode: string;
  departmentCode: string;
  coordinates: LatLng;
  /** BAN id when the address was resolved through the geocoder. */
  banId?: string;
}

/**
 * Physical + declarative characteristics.
 * Every field is optional: the wizard asks only what the type requires.
 */
export interface PropertyFeatures {
  /** Living area (m²) — `surface habitable`. */
  livingArea?: number;
  /** Plot area (m²). */
  landArea?: number;
  rooms?: number;
  bedrooms?: number;
  /** 0 = ground floor. */
  floor?: number;
  floorsTotal?: number;
  hasElevator?: boolean;
  hasParking?: boolean;
  parkingSpots?: number;
  hasGarage?: boolean;
  outdoor?: OutdoorFeature;
  outdoorArea?: number;
  condition?: PropertyCondition;
  constructionYear?: number;
  /** Only meaningful for land. `undefined` = unknown, not "no". */
  isBuildable?: boolean;
  /** Free-form notes from a pro. */
  notes?: string;
}

export interface Property {
  id: string;
  ownerId?: string;
  organizationId?: string;
  label?: string;
  type: PropertyType;
  usage: PropertyUsage;
  address: PropertyAddress;
  features: PropertyFeatures;
  createdAt: string;
  updatedAt: string;
}

/** What the estimator wizard collects before a `Property` exists. */
export interface PropertyDraft {
  type: PropertyType;
  address: GeoAddress;
  features: PropertyFeatures;
}

/** Why the owner wants a value — the core lead-scoring signal. */
export type ProjectIntent =
  | "curiosity"
  | "buying"
  | "selling_considering"
  | "selling_under_3m"
  | "selling_under_6m"
  | "inheritance"
  | "investment"
  | "other";

export const PROJECT_INTENT_LABELS: Record<ProjectIntent, string> = {
  curiosity: "Simple curiosité",
  buying: "Achat",
  selling_considering: "Vente envisagée",
  selling_under_3m: "Vente dans moins de 3 mois",
  selling_under_6m: "Vente dans moins de 6 mois",
  inheritance: "Succession",
  investment: "Investissement",
  other: "Autre",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  building: "Immeuble",
  parking: "Parking",
  retail: "Commerce",
  office: "Bureaux",
  business_premises: "Local professionnel",
  other: "Autre",
};

export const PROPERTY_CONDITION_LABELS: Record<PropertyCondition, string> = {
  to_renovate: "À rénover",
  refresh_needed: "Travaux de rafraîchissement",
  good: "Bon état",
  very_good: "Très bon état",
  new: "Neuf / récent",
};
