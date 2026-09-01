/**
 * Commune resolution — which INSEE codes cover a point or a viewport.
 *
 * DVF is published per commune, so every map query starts here. The API
 * (`geo.api.gouv.fr`) only answers point-in-polygon, never "give me the
 * communes of this box", hence the grid sampling below.
 *
 * Cost control is deliberate and visible: one bad viewport must not fan out
 * into fifty upstream calls. We sample a bounded grid, dedupe, and tell the
 * caller when the answer was truncated instead of silently dropping communes.
 */

import type { BBox, Commune, LatLng } from "@/types/geo";
import { createAsyncCache } from "@/lib/dvf/cache";
import { bboxCenter, bboxMaxSpanMeters, haversineMeters } from "./distance";
import { departmentCodeFromInsee, isPlmParentCommune } from "./insee";
import { reverseGeocode } from "./geocoder";

const GEO_API = "https://geo.api.gouv.fr/communes";

/** Beyond this the latency and the upstream load stop being reasonable. */
export const MAX_COMMUNES_PER_QUERY = 12;

const COMMUNE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // Boundaries move once a year at most.
const communeCache = createAsyncCache<Commune | null>({
  ttlMs: COMMUNE_TTL_MS,
  maxEntries: 500,
});

export class CommuneLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommuneLookupError";
  }
}

export interface CommunesInBoundsResult {
  communes: Commune[];
  /** True when the grid found more communes than `MAX_COMMUNES_PER_QUERY`. */
  truncated: boolean;
}

/** The commune containing `point`, or `null` outside French territory. */
export async function communeAtPoint(point: LatLng, signal?: AbortSignal): Promise<Commune | null> {
  // 4 decimals ≈ 11 m: fine enough to be correct, coarse enough to cache well.
  const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  return communeCache.get(key, () => loadCommuneAtPoint(point, signal));
}

/**
 * Communes intersecting `bbox`, found by sampling a grid.
 *
 * The grid is 3×3 for a small viewport and 4×4 for a large one — enough to
 * catch a commune wedged in a corner without turning a pan into a storm of
 * requests. Sampling can still miss a sliver commune; that is a documented
 * approximation, and the UI states which communes were consulted.
 */
export async function communesInBBox(
  bbox: BBox,
  opts?: { signal?: AbortSignal; maxCommunes?: number },
): Promise<CommunesInBoundsResult> {
  const max = Math.max(1, opts?.maxCommunes ?? MAX_COMMUNES_PER_QUERY);
  const span = bboxMaxSpanMeters(bbox);
  const steps = span > 6_000 ? 4 : 3;

  const samples = gridSamples(bbox, steps);
  const settled = await Promise.all(
    samples.map((p) =>
      communeAtPoint(p, opts?.signal).catch((error: unknown) => {
        if (isAbort(error)) throw error;
        return null;
      }),
    ),
  );

  const byCode = new Map<string, Commune>();
  for (const commune of settled) {
    if (commune && !byCode.has(commune.code)) byCode.set(commune.code, commune);
  }

  if (byCode.size === 0) {
    // Centre fallback: a tiny viewport can land its whole grid on water.
    const fallback = await communeAtPoint(bboxCenter(bbox), opts?.signal);
    if (fallback) byCode.set(fallback.code, fallback);
  }

  const center = bboxCenter(bbox);
  const ordered = [...byCode.values()].sort(
    (a, b) => distanceToCenter(a, center) - distanceToCenter(b, center),
  );

  return {
    communes: ordered.slice(0, max),
    truncated: ordered.length > max,
  };
}

async function loadCommuneAtPoint(point: LatLng, signal?: AbortSignal): Promise<Commune | null> {
  const url = new URL(GEO_API);
  url.searchParams.set("lat", point.lat.toFixed(6));
  url.searchParams.set("lon", point.lng.toFixed(6));
  url.searchParams.set("fields", "code,nom,centre,population,codesPostaux,codeDepartement");

  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 604_800 },
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new CommuneLookupError("Le référentiel des communes est injoignable.");
  }

  if (!response.ok) {
    throw new CommuneLookupError(`Le référentiel des communes a répondu ${response.status}.`);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length === 0) return null;

  const raw = body[0];
  if (!isRecord(raw)) return null;

  const code = typeof raw.code === "string" ? raw.code : undefined;
  const name = typeof raw.nom === "string" ? raw.nom : undefined;
  if (!code || !name) return null;

  const departmentCode =
    (typeof raw.codeDepartement === "string" ? raw.codeDepartement : undefined) ??
    departmentCodeFromInsee(code);
  if (!departmentCode) return null;

  const commune: Commune = {
    code,
    name,
    departmentCode,
    postcodes: Array.isArray(raw.codesPostaux)
      ? raw.codesPostaux.filter((c): c is string => typeof c === "string")
      : undefined,
    population: typeof raw.population === "number" ? raw.population : undefined,
    center: toCenter(raw.centre),
  };

  // Paris / Lyon / Marseille: the INSEE answer is the parent commune, but DVF
  // publishes one file per arrondissement. The BAN reverse geocoder resolves
  // the arrondissement code for us; if it fails we keep the parent and let the
  // provider expand it (capped), rather than dropping the query.
  if (isPlmParentCommune(code)) {
    const refined = await refineArrondissement(point, commune, signal);
    if (refined) return refined;
  }

  return commune;
}

async function refineArrondissement(
  point: LatLng,
  parent: Commune,
  signal?: AbortSignal,
): Promise<Commune | null> {
  try {
    const address = await reverseGeocode(point, signal);
    if (!address || address.cityCode === parent.code) return null;
    return {
      ...parent,
      code: address.cityCode,
      name: address.context?.includes("Arrondissement") ? address.context : parent.name,
      center: { lat: point.lat, lng: point.lng },
    };
  } catch (error) {
    if (isAbort(error)) throw error;
    return null;
  }
}

function gridSamples(bbox: BBox, steps: number): LatLng[] {
  const [west, south, east, north] = bbox;
  const points: LatLng[] = [];
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      // (i + 0.5) / steps keeps samples off the exact edges, where a shared
      // boundary would flip arbitrarily between two communes.
      points.push({
        lng: west + ((i + 0.5) * (east - west)) / steps,
        lat: south + ((j + 0.5) * (north - south)) / steps,
      });
    }
  }
  return points;
}

function distanceToCenter(commune: Commune, center: LatLng): number {
  return commune.center ? haversineMeters(commune.center, center) : Number.POSITIVE_INFINITY;
}

function toCenter(value: unknown): LatLng | undefined {
  if (!isRecord(value)) return undefined;
  const coords = value.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return undefined;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
