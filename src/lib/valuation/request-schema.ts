/**
 * Zod contract for `POST /api/estimation`.
 *
 * The browser is never trusted: the wizard, the pro basket and any third party
 * hitting the endpoint go through exactly this schema. Bounds are wide enough
 * not to reject a legitimate property, and tight enough that no payload can
 * push the engine into absurd arithmetic (a 1 000 000 m² flat, a weight of 1e9).
 *
 * It lives next to the engine rather than in the route so it can be unit-tested
 * and reused by the pro flow.
 */

import { z } from "zod";
import type { ValuationRequest } from "@/types/valuation";

const CURRENT_YEAR = new Date().getFullYear();

const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const geoAddressSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(400),
  kind: z.enum(["housenumber", "street", "locality", "municipality"]),
  houseNumber: z.string().max(40).optional(),
  street: z.string().max(200).optional(),
  postcode: z.string().max(10).optional(),
  city: z.string().min(1).max(200),
  cityCode: z.string().min(1).max(10),
  departmentCode: z.string().min(1).max(5),
  context: z.string().max(200).optional(),
  coordinates: latLngSchema,
  // Geocoder relevance. Unused by the engine, so we accept and neutralise it
  // rather than 400 on a provider that scales it differently.
  score: z.number().optional().default(0),
});

const featuresSchema = z.object({
  livingArea: z.number().positive().max(10_000).optional(),
  landArea: z.number().positive().max(10_000_000).optional(),
  rooms: z.number().int().min(1).max(50).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  floor: z.number().int().min(-5).max(200).optional(),
  floorsTotal: z.number().int().min(0).max(200).optional(),
  hasElevator: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  parkingSpots: z.number().int().min(0).max(100).optional(),
  hasGarage: z.boolean().optional(),
  outdoor: z.enum(["balcony", "terrace", "garden", "none"]).optional(),
  outdoorArea: z.number().min(0).max(100_000).optional(),
  condition: z.enum(["to_renovate", "refresh_needed", "good", "very_good", "new"]).optional(),
  constructionYear: z.number().int().min(1000).max(CURRENT_YEAR + 5).optional(),
  isBuildable: z.boolean().optional(),
  notes: z.string().max(2_000).optional(),
});

export const propertyDraftSchema = z.object({
  type: z.enum([
    "apartment",
    "house",
    "land",
    "building",
    "parking",
    "retail",
    "office",
    "business_premises",
    "other",
  ]),
  address: geoAddressSchema,
  features: featuresSchema.default({}),
});

export const projectIntentSchema = z.enum([
  "curiosity",
  "buying",
  "selling_considering",
  "selling_under_3m",
  "selling_under_6m",
  "inheritance",
  "investment",
  "other",
]);

export const valuationRequestSchema = z.object({
  subject: propertyDraftSchema,
  intent: projectIntentSchema.optional(),
  /** Pro basket. Capped so a payload cannot fan out into 10 000 provider calls. */
  comparableIds: z.array(z.string().min(1).max(200)).max(60).optional(),
  manualWeights: z.record(z.string().min(1).max(200), z.number().min(0).max(3)).optional(),
  excludedIds: z.array(z.string().min(1).max(200)).max(200).optional(),
});

export type ValuationRequestInput = z.infer<typeof valuationRequestSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ParseOutcome =
  | { success: true; data: ValuationRequest }
  | { success: false; issues: ValidationIssue[] };

/**
 * The explicit `ValuationRequest` return type is load-bearing: it makes `tsc`
 * fail the build if this schema ever drifts from the frozen contract.
 */
export function parseValuationRequest(input: unknown): ParseOutcome {
  const parsed = valuationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { success: true, data: parsed.data };
}
