/**
 * Wire-level validation for the DVF routes.
 *
 * Nothing from the client is trusted: the viewport, the radius and the row cap
 * are all re-clamped here. A hand-crafted `?bbox=-180,-90,180,90&limit=99999`
 * must degrade into a refusal, never into a France-wide download.
 */

import { z } from "zod";
import type { BBox } from "@/types/geo";
import type { DvfBoundsQuery, DvfQueryFilters, DvfRadiusQuery } from "@/types/dvf";
import { bboxArea } from "@/lib/geo/distance";
import { DVF_MAX_LIMIT } from "./filters";

/** Widest viewport we will resolve. ~20 km × 20 km — a large city. */
export const MAX_QUERY_AREA_KM2 = 400;
/** Widest radius query. Beyond this the comparables stop being comparable. */
export const MAX_QUERY_RADIUS_M = 10_000;
export const MIN_QUERY_RADIUS_M = 50;

const propertyType = z.enum(["apartment", "house", "land", "commercial", "dependency", "other"]);

/** `types=apartment,house` — repeated params are accepted too. */
const csvEnumList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0),
  )
  .pipe(z.array(propertyType).min(1).max(6));

const positiveInt = z.coerce.number().int().nonnegative();
const yearBound = z.coerce.number().int().min(1990).max(2100);

const bboxSchema = z
  .string()
  .transform((value) => value.split(",").map((n) => Number(n.trim())))
  .pipe(z.array(z.number().finite()).length(4))
  .transform((values, ctx): BBox => {
    const [west, south, east, north] = values as [number, number, number, number];
    if (west >= east || south >= north) {
      ctx.addIssue({ code: "custom", message: "bbox: ordre attendu ouest,sud,est,nord" });
      return z.NEVER;
    }
    if (west < -180 || east > 180 || south < -90 || north > 90) {
      ctx.addIssue({ code: "custom", message: "bbox hors des bornes géographiques" });
      return z.NEVER;
    }
    if (bboxArea([west, south, east, north]) > MAX_QUERY_AREA_KM2) {
      ctx.addIssue({
        code: "custom",
        message: `Emprise trop large (maximum ${MAX_QUERY_AREA_KM2} km²). Zoomez davantage.`,
      });
      return z.NEVER;
    }
    return [west, south, east, north];
  });

const filtersSchema = z.object({
  types: csvEnumList.optional(),
  yearMin: yearBound.optional(),
  yearMax: yearBound.optional(),
  priceMin: positiveInt.max(500_000_000).optional(),
  priceMax: positiveInt.max(500_000_000).optional(),
  areaMin: positiveInt.max(100_000).optional(),
  areaMax: positiveInt.max(100_000).optional(),
  pricePerSqmMin: positiveInt.max(1_000_000).optional(),
  pricePerSqmMax: positiveInt.max(1_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(DVF_MAX_LIMIT).optional(),
});

export const dvfQuerySchema = z
  .object({
    bbox: bboxSchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(MIN_QUERY_RADIUS_M).max(MAX_QUERY_RADIUS_M).optional(),
  })
  .and(filtersSchema)
  .superRefine((value, ctx) => {
    const hasPoint = value.lat !== undefined && value.lng !== undefined;
    if (!value.bbox && !hasPoint) {
      ctx.addIssue({
        code: "custom",
        message: "Fournir soit `bbox=ouest,sud,est,nord`, soit `lat` et `lng`.",
      });
    }
    if (
      value.yearMin !== undefined &&
      value.yearMax !== undefined &&
      value.yearMin > value.yearMax
    ) {
      ctx.addIssue({ code: "custom", message: "`yearMin` doit être ≤ `yearMax`." });
    }
    if (
      value.priceMin !== undefined &&
      value.priceMax !== undefined &&
      value.priceMin > value.priceMax
    ) {
      ctx.addIssue({ code: "custom", message: "`priceMin` doit être ≤ `priceMax`." });
    }
    if (value.areaMin !== undefined && value.areaMax !== undefined && value.areaMin > value.areaMax) {
      ctx.addIssue({ code: "custom", message: "`areaMin` doit être ≤ `areaMax`." });
    }
  });

export type DvfQueryInput = z.infer<typeof dvfQuerySchema>;

export function toFilters(input: DvfQueryInput): DvfQueryFilters {
  return {
    propertyTypes: input.types,
    yearMin: input.yearMin,
    yearMax: input.yearMax,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    areaMin: input.areaMin,
    areaMax: input.areaMax,
    pricePerSqmMin: input.pricePerSqmMin,
    pricePerSqmMax: input.pricePerSqmMax,
    limit: input.limit,
  };
}

export function toBoundsQuery(input: DvfQueryInput): DvfBoundsQuery | null {
  return input.bbox ? { ...toFilters(input), bbox: input.bbox } : null;
}

export function toRadiusQuery(input: DvfQueryInput): DvfRadiusQuery | null {
  if (input.lat === undefined || input.lng === undefined) return null;
  return {
    ...toFilters(input),
    center: { lat: input.lat, lng: input.lng },
    radius: input.radius ?? 1000,
  };
}

/** `?q=…&limit=…` for the geocoding route. */
export const geocodeQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(15).optional(),
});

/** Flattens zod issues into one readable French sentence. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join(" · ");
}
