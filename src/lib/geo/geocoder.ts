/**
 * Address geocoding — Géoplateforme IGN (BAN).
 *
 * `https://data.geopf.fr/geocodage/*` is the official successor of
 * `api-adresse.data.gouv.fr`; same BAN behind it, no API key. The deprecated
 * host must never be reintroduced.
 *
 * The adapter is the only place allowed to know the wire format: components
 * receive `GeoAddress` and nothing else.
 */

import type { AddressKind, GeoAddress, LatLng } from "@/types/geo";
import { departmentCodeFromInsee } from "./insee";

const GEOCODER_BASE = "https://data.geopf.fr/geocodage";

/** The BAN never returns more than a handful of useful rows. */
const MAX_LIMIT = 15;
const DEFAULT_LIMIT = 7;

export class GeocoderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "GeocoderError";
  }
}

interface BanProperties {
  label?: unknown;
  score?: unknown;
  housenumber?: unknown;
  street?: unknown;
  postcode?: unknown;
  citycode?: unknown;
  city?: unknown;
  context?: unknown;
  type?: unknown;
  id?: unknown;
  banId?: unknown;
  name?: unknown;
  depcode?: unknown;
  district?: unknown;
}

interface BanFeature {
  properties?: BanProperties;
  geometry?: { coordinates?: unknown };
}

/**
 * Autocomplete search. Returns `[]` for a query too short to be meaningful —
 * callers must not have to guard.
 */
export async function searchAddresses(
  query: string,
  opts?: { limit?: number; signal?: AbortSignal; near?: LatLng },
): Promise<GeoAddress[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const limit = clampLimit(opts?.limit);
  const url = new URL(`${GEOCODER_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("index", "address");
  url.searchParams.set("limit", String(limit));
  if (opts?.near) {
    // Biases ranking towards the current map view without filtering anything out.
    url.searchParams.set("lat", opts.near.lat.toFixed(6));
    url.searchParams.set("lon", opts.near.lng.toFixed(6));
  }

  const features = await fetchFeatures(url, opts?.signal);
  return features
    .map(toGeoAddress)
    .filter((a): a is GeoAddress => a !== null)
    .slice(0, limit);
}

/** Nearest known address to a point. `null` when the BAN knows nothing there. */
export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<GeoAddress | null> {
  const url = new URL(`${GEOCODER_BASE}/reverse`);
  url.searchParams.set("lat", point.lat.toFixed(6));
  url.searchParams.set("lon", point.lng.toFixed(6));
  url.searchParams.set("index", "address");
  url.searchParams.set("limit", "1");

  const features = await fetchFeatures(url, signal);
  const first = features[0];
  return first ? toGeoAddress(first) : null;
}

async function fetchFeatures(url: URL, signal?: AbortSignal): Promise<BanFeature[]> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
      // Address results are stable; a day of edge cache costs nothing.
      next: { revalidate: 86_400 },
    });
  } catch (error) {
    // AbortError must stay an abort: the autocomplete relies on it to stay quiet.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GeocoderError("Le service d'adresses est injoignable.", 503);
  }

  if (!response.ok) {
    throw new GeocoderError(
      `Le service d'adresses a répondu ${response.status}.`,
      response.status === 429 ? 429 : 502,
    );
  }

  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.features)) return [];
  return body.features.filter(isRecord) as BanFeature[];
}

function toGeoAddress(feature: BanFeature): GeoAddress | null {
  const p = feature.properties;
  if (!p) return null;

  const coords = feature.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cityCode = str(p.citycode);
  const city = str(p.city);
  if (!cityCode || !city) return null;

  const label = str(p.label) ?? str(p.name) ?? city;
  const departmentCode = str(p.depcode) ?? departmentCodeFromInsee(cityCode);
  if (!departmentCode) return null;

  return {
    id: str(p.id) ?? str(p.banId) ?? `${cityCode}:${label}`,
    label,
    kind: toKind(str(p.type)),
    houseNumber: str(p.housenumber),
    street: str(p.street) ?? str(p.name),
    postcode: str(p.postcode),
    city,
    cityCode,
    departmentCode,
    context: str(p.context) ?? str(p.district),
    coordinates: { lat, lng },
    score: clamp01(Number(p.score)),
  };
}

function toKind(type: string | undefined): AddressKind {
  switch (type) {
    case "housenumber":
    case "street":
    case "locality":
    case "municipality":
      return type;
    default:
      // The BAN occasionally emits other buckets (poi…). "locality" is the
      // honest generic: something localised, not necessarily a street.
      return "locality";
  }
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit as number)));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
