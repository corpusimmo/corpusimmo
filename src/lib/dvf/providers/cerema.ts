/**
 * Secondary provider — Cerema DVF+ open data.
 *
 * `https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/` serves DVF
 * already consolidated at MUTATION level (`valeurfonc`, `sbati`, `sterr`,
 * `codtypbien`), which removes the multi-line trap by construction. In
 * exchange it comes with two hard operational limits, both verified:
 *
 *   - the bounding box is capped at 0,02° × 0,02° — a larger one answers
 *     HTTP 403 `{"detail": "Emprise demandée trop importante…"}`;
 *   - the service is a *preprod* host and returns 5xx from time to time.
 *
 * Both failures raise `DvfProviderError`. There is deliberately no fallback to
 * the demo dataset: showing invented prices because an API blinked would be
 * the single worst thing this product could do.
 */

import type {
  DvfBoundsQuery,
  DvfMutationNature,
  DvfPropertyType,
  DvfProvider,
  DvfRadiusQuery,
  DvfResult,
  DvfTransaction,
} from "@/types/dvf";
import { DvfProviderError } from "@/types/dvf";
import type { BBox, LatLng } from "@/types/geo";
import { bboxAround, bboxCenter } from "@/lib/geo/distance";
import { departmentCodeFromInsee } from "@/lib/geo/insee";
import { createAsyncCache, DVF_TTL_MS } from "../cache";
import { inBBox, selectRows, withinRadius } from "../filters";

const BASE_URL = "https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/";

/** Documented server-side ceiling, in degrees, on each axis. */
export const CEREMA_MAX_BBOX_DEGREES = 0.02;

/** Upstream page size; the API paginates beyond this. */
const PAGE_SIZE = 500;
const MAX_PAGES = 4;

const responseCache = createAsyncCache<DvfTransaction[]>({ ttlMs: DVF_TTL_MS, maxEntries: 60 });

/**
 * Rows already served, so a detail lookup does not need a second round-trip.
 * A cold process falls back to re-querying the coordinates embedded in the id.
 */
const rowById = createAsyncCache<DvfTransaction | null>({ ttlMs: DVF_TTL_MS, maxEntries: 2000 });

export const ceremaProvider: DvfProvider = {
  id: "cerema",
  label: "DVF+ open data (Cerema)",

  async getTransactionsByBounds(query: DvfBoundsQuery): Promise<DvfResult> {
    const bbox = assertBboxWithinLimit(query.bbox);
    const rows = await fetchMutations(bbox, query.yearMin);
    return toResult(rows, query, inBBox(query.bbox));
  },

  async getTransactionsNearPoint(query: DvfRadiusQuery): Promise<DvfResult> {
    const bbox = assertBboxWithinLimit(bboxAround(query.center, query.radius));
    const rows = await fetchMutations(bbox, query.yearMin);
    return toResult(rows, query, withinRadius(query.center, query.radius));
  },

  async getTransactionById(id: string): Promise<DvfTransaction | null> {
    const cached = rowById.peek(id);
    if (cached !== undefined) return cached;

    const parsed = parseCeremaId(id);
    if (!parsed) return null;

    // The API exposes no detail endpoint keyed on `idopendata`, so the id
    // carries the position and we re-query a tiny box around it.
    const bbox = clampBbox(bboxAround(parsed.point, 120));
    const rows = await fetchMutations(bbox, undefined);
    return rows.find((row) => row.id === id) ?? null;
  },
};

function toResult(
  rows: DvfTransaction[],
  query: DvfBoundsQuery | DvfRadiusQuery,
  predicate: (row: DvfTransaction) => boolean,
): DvfResult {
  const { rows: kept, truncated } = selectRows(rows, query, predicate);
  const communes = [...new Set(rows.map((r) => r.city).filter((c) => c.length > 0))];
  let latestYear: number | undefined;
  for (const row of rows) if (latestYear === undefined || row.year > latestYear) latestYear = row.year;

  return {
    transactions: kept,
    count: kept.length,
    truncated,
    source: "cerema",
    communes,
    latestYear,
  };
}

async function fetchMutations(bbox: BBox, yearMin: number | undefined): Promise<DvfTransaction[]> {
  const key = `${bbox.map((n) => n.toFixed(4)).join(",")}|${yearMin ?? ""}`;
  return responseCache.get(key, async () => {
    const collected: DvfTransaction[] = [];
    let url: string | null = buildUrl(bbox, yearMin);

    for (let page = 0; page < MAX_PAGES && url; page += 1) {
      const body: unknown = await requestJson(url);
      if (!isRecord(body)) break;

      const features = Array.isArray(body.features) ? body.features : [];
      for (const feature of features) {
        const row = toTransaction(feature);
        if (row) {
          collected.push(row);
          rowById.set(row.id, row);
        }
      }

      url = typeof body.next === "string" && body.next.length > 0 ? body.next : null;
    }

    return collected;
  });
}

function buildUrl(bbox: BBox, yearMin: number | undefined): string {
  const url = new URL(BASE_URL);
  url.searchParams.set("in_bbox", bbox.map((n) => n.toFixed(6)).join(","));
  url.searchParams.set("page_size", String(PAGE_SIZE));
  if (yearMin !== undefined) url.searchParams.set("anneemut_min", String(yearMin));
  return url.toString();
}

async function requestJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });
  } catch (error) {
    throw new DvfProviderError("L'API DVF+ du Cerema est injoignable.", error, 503);
  }

  if (response.status === 400 || response.status === 403) {
    // The documented answer to an oversized bbox — surface it as-is rather
    // than pretending the area simply has no sales.
    throw new DvfProviderError(
      "L'emprise demandée dépasse la limite de l'API Cerema (0,02° × 0,02°). Zoomez davantage.",
      undefined,
      400,
    );
  }
  if (response.status >= 500) {
    throw new DvfProviderError(
      "L'API DVF+ du Cerema est momentanément indisponible (service en préproduction).",
      undefined,
      503,
    );
  }
  if (!response.ok) {
    throw new DvfProviderError(`L'API DVF+ du Cerema a répondu ${response.status}.`, undefined, 502);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new DvfProviderError("Réponse illisible de l'API DVF+ du Cerema.", error, 502);
  }
}

function toTransaction(feature: unknown): DvfTransaction | null {
  if (!isRecord(feature)) return null;
  const props = feature.properties;
  if (!isRecord(props)) return null;

  const point = centroidOf(feature.geometry);
  if (!point) return null;

  const price = toNumber(props.valeurfonc);
  if (price === undefined || price < 1000) return null;

  const date = typeof props.datemut === "string" ? props.datemut : undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const idopendata =
    typeof props.idopendata === "string"
      ? props.idopendata
      : typeof props.idmutinvar === "string"
        ? props.idmutinvar
        : undefined;
  if (!idopendata) return null;

  const communes = Array.isArray(props.l_codinsee)
    ? props.l_codinsee.filter((c): c is string => typeof c === "string")
    : [];
  const cityCode = communes[0] ?? "";
  const departmentCode =
    (typeof props.coddep === "string" ? props.coddep : undefined) ??
    (cityCode ? departmentCodeFromInsee(cityCode) : undefined) ??
    "";

  const typeCode = String(props.codtypbien ?? "");
  const propertyType = mapCeremaType(typeCode);
  const builtArea = positive(toNumber(props.sbati));
  const landArea = positive(toNumber(props.sterr));
  const lotCount = toNumber(props.nblocmut);
  const parcelCount = toNumber(props.nbparmut);

  const isMultiLot = (lotCount ?? 0) > 1 || (parcelCount ?? 0) > 1 || isPluralType(typeCode);

  const usableArea = propertyType === "land" ? undefined : builtArea;
  const pricePerSqm = usableArea && usableArea > 0 ? Math.round(price / usableArea) : undefined;

  return {
    id: `cerema:${idopendata}@${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
    date,
    year: Number(date.slice(0, 4)),
    nature: mapCeremaNature(props.libnatmut, props.vefa),
    price,
    propertyType,
    propertyTypeLabel: typeof props.libtypbien === "string" ? props.libtypbien : undefined,
    builtArea: usableArea,
    landArea,
    // DVF+ open data does not expose the room count; leaving it undefined is
    // the honest answer (see the data-honesty rule in `src/types/dvf.ts`).
    rooms: undefined,
    // Nor a street address: the mutation is located by geometry only.
    addressLabel: undefined,
    postcode: undefined,
    city: cityCode,
    cityCode,
    departmentCode,
    coordinates: point,
    pricePerSqm,
    isMultiLot,
    lotCount: lotCount !== undefined && lotCount > 0 ? lotCount : undefined,
    source: "cerema",
  };
}

/**
 * DVF+ `codtypbien`: 1xx built, 2xx/3xx land.
 * 111/112 maison(s) · 120→123 appartement(s) · 131/132 dépendance(s) ·
 * 14 activité · 151/152 bâti mixte · 21 terrain à bâtir · 22x/23xx terrains.
 */
export function mapCeremaType(code: string): DvfPropertyType {
  if (code.startsWith("111") || code.startsWith("112")) return "house";
  if (code.startsWith("12")) return "apartment";
  if (code.startsWith("13")) return "dependency";
  if (code === "14" || code.startsWith("14")) return "commercial";
  if (code.startsWith("15")) return "other"; // bâti mixte: neither one nor the other
  if (code.startsWith("10")) return "other"; // bâti indéterminé
  if (code.startsWith("2") || code.startsWith("3")) return "land";
  return "other";
}

function isPluralType(code: string): boolean {
  // 112 = DES MAISONS, 122/123 = plusieurs appartements, 132 = DES DEPENDANCES.
  return code === "112" || code === "122" || code === "123" || code === "132";
}

function mapCeremaNature(libnatmut: unknown, vefa: unknown): DvfMutationNature {
  if (vefa === true) return "sale_off_plan";
  const value = typeof libnatmut === "string" ? libnatmut.trim().toLowerCase() : "";
  if (value.startsWith("vente terrain")) return "sale_land_to_build";
  if (value.startsWith("vente")) return "sale";
  if (value.startsWith("echange") || value.startsWith("échange")) return "exchange";
  if (value.startsWith("adjudication")) return "auction";
  if (value.startsWith("expropriation")) return "expropriation";
  return "other";
}

/** Area-weighted centroid of the mutation footprint (MultiPolygon or Polygon). */
function centroidOf(geometry: unknown): LatLng | null {
  if (!isRecord(geometry)) return null;
  const coords = geometry.coordinates;
  const positions: [number, number][] = [];
  collectPositions(coords, positions, 0);
  if (positions.length === 0) return null;

  let lat = 0;
  let lng = 0;
  for (const [x, y] of positions) {
    lng += x;
    lat += y;
  }
  return { lat: lat / positions.length, lng: lng / positions.length };
}

function collectPositions(value: unknown, out: [number, number][], depth: number): void {
  if (!Array.isArray(value) || depth > 4) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    const x = value[0];
    const y = value[1];
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([x, y]);
    return;
  }
  for (const item of value) collectPositions(item, out, depth + 1);
}

function assertBboxWithinLimit(bbox: BBox): BBox {
  const [west, south, east, north] = bbox;
  if (east - west > CEREMA_MAX_BBOX_DEGREES || north - south > CEREMA_MAX_BBOX_DEGREES) {
    throw new DvfProviderError(
      "L'emprise demandée dépasse la limite de l'API Cerema (0,02° × 0,02°). Zoomez davantage.",
      undefined,
      400,
    );
  }
  return bbox;
}

function clampBbox(bbox: BBox): BBox {
  const center = bboxCenter(bbox);
  const half = CEREMA_MAX_BBOX_DEGREES / 2;
  const [west, south, east, north] = bbox;
  return [
    Math.max(west, center.lng - half),
    Math.max(south, center.lat - half),
    Math.min(east, center.lng + half),
    Math.min(north, center.lat + half),
  ];
}

/** `cerema:<idopendata>@47.21234,-1.55321` */
export function parseCeremaId(id: string): { idopendata: string; point: LatLng } | null {
  if (!id.startsWith("cerema:")) return null;
  const rest = id.slice("cerema:".length);
  const at = rest.lastIndexOf("@");
  if (at < 0) return null;
  const idopendata = rest.slice(0, at);
  const [latRaw, lngRaw] = rest.slice(at + 1).split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!idopendata || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { idopendata, point: { lat, lng } };
}

/** Exposed so callers can pre-clamp a viewport instead of eating a 403. */
export function isBboxAcceptedByCerema(bbox: BBox): boolean {
  return (
    bbox[2] - bbox[0] <= CEREMA_MAX_BBOX_DEGREES && bbox[3] - bbox[1] <= CEREMA_MAX_BBOX_DEGREES
  );
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
