/**
 * geo-DVF CSV → `DvfTransaction[]`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE ONE TRAP THAT MAKES EVERY NAIVE DVF PRICE WRONG
 * ────────────────────────────────────────────────────────────────────────────
 * A *mutation* (one notarial sale, keyed by `id_mutation`) is published as
 * SEVERAL CSV lines — one per local and per parcel involved. `valeur_fonciere`
 * is the price of the WHOLE mutation and is REPEATED verbatim on every line.
 *
 * So a house sold 363 000 € with two outbuildings appears three times at
 * 363 000 €. Computing €/m² line by line therefore:
 *   - counts the same sale N times in the median, and
 *   - divides the full price by one lot's surface, inflating €/m².
 *
 * Measured on the real 2024 file for Nantes (INSEE 44109, 12 883 lines →
 * 5 682 mutations): the naive per-line median lands at 3 525 €/m² for flats,
 * the correctly grouped one at 3 435 €/m². Same file, +2.6 % of pure artefact —
 * and far worse on communes with many house+garage sales.
 *
 * Rules applied here, per `id_mutation`:
 *   1. price   → the repeated `valeur_fonciere` counted ONCE;
 *   2. built   → sum of `surface_reelle_bati` over dwelling lines only
 *                (Maison / Appartement). geo-DVF never repeats a local across
 *                parcels, so a plain sum is right — verified on 5 682 Nantes
 *                mutations, zero duplicated local signature;
 *   3. land    → sum of `surface_terrain` DEDUPLICATED BY `id_parcelle`,
 *                because the parcel surface *is* repeated on every local line;
 *   4. type    → dominant dwelling type, falling back to commercial, then
 *                dependency, then land;
 *   5. isMultiLot → several built locals or several built parcels.
 *
 * Mutations without coordinates are dropped (they cannot be mapped) but are
 * counted in the rejection report instead of vanishing silently.
 */

import type {
  DvfMutationNature,
  DvfPropertyType,
  DvfSourceId,
  DvfTransaction,
} from "@/types/dvf";
import type { LatLng } from "@/types/geo";
import { columnIndex, parseCsvRows } from "./csv";
import {
  DVF_LOCAL_TYPE_CODES,
  type DvfNormalizationResult,
  type DvfRejectReason,
} from "./types";

/** Columns without which the file is not a geo-DVF export at all. */
export const REQUIRED_GEO_DVF_COLUMNS = [
  "id_mutation",
  "date_mutation",
  "nature_mutation",
  "valeur_fonciere",
  "code_commune",
  "longitude",
  "latitude",
] as const;

export class DvfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DvfParseError";
  }
}

/** Guard against typos and against DVF's own outliers (1 € symbolic sales). */
const MIN_PLAUSIBLE_PRICE = 1_000;
const MAX_PLAUSIBLE_PRICE = 500_000_000;
const MIN_PLAUSIBLE_AREA = 5;
const MAX_PLAUSIBLE_AREA = 100_000;

interface RawLine {
  idMutation: string;
  date: string;
  nature: string;
  price: number | undefined;
  addressNumber: string | undefined;
  addressSuffix: string | undefined;
  street: string | undefined;
  postcode: string | undefined;
  cityCode: string;
  city: string;
  departmentCode: string;
  parcelId: string | undefined;
  lotCount: number | undefined;
  localTypeCode: string | undefined;
  localTypeLabel: string | undefined;
  builtArea: number | undefined;
  rooms: number | undefined;
  landArea: number | undefined;
  natureCulture: string | undefined;
  coordinates: LatLng | undefined;
}

export interface NormalizeOptions {
  /** Which provider id ends up on every row. Defaults to `geodvf`. */
  source?: DvfSourceId;
  /** Overrides the commune code when the file is trusted more than the rows. */
  cityCode?: string;
}

/**
 * Parses a full geo-DVF commune file. Throws `DvfParseError` only when the
 * document is structurally not geo-DVF; individual bad lines are counted, not
 * fatal.
 */
export function parseGeoDvfCsv(csv: string, options: NormalizeOptions = {}): DvfNormalizationResult {
  const rows = parseCsvRows(csv);
  const header = rows[0];
  if (!header) {
    throw new DvfParseError("Fichier DVF vide.");
  }

  const index = columnIndex(header);
  const missing = REQUIRED_GEO_DVF_COLUMNS.filter((c) => !index.has(c));
  if (missing.length > 0) {
    throw new DvfParseError(`Colonnes DVF manquantes : ${missing.join(", ")}.`);
  }

  const rejected = new Map<DvfRejectReason, number>();
  const reject = (reason: DvfRejectReason, n = 1): void => {
    rejected.set(reason, (rejected.get(reason) ?? 0) + n);
  };

  const groups = new Map<string, RawLine[]>();
  let sourceRows = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    if (!cells || cells.length === 0) continue;
    sourceRows += 1;

    const line = toRawLine(cells, index, options.cityCode);
    if (!line) {
      reject("malformed_row");
      continue;
    }

    const bucket = groups.get(line.idMutation);
    if (bucket) bucket.push(line);
    else groups.set(line.idMutation, [line]);
  }

  const source: DvfSourceId = options.source ?? "geodvf";
  const transactions: DvfTransaction[] = [];

  for (const [idMutation, lines] of groups) {
    const outcome = groupToTransaction(idMutation, lines, source);
    if (typeof outcome === "string") reject(outcome);
    else transactions.push(outcome);
  }

  return {
    transactions,
    report: {
      sourceRows,
      mutations: groups.size,
      kept: transactions.length,
      rejected: [...rejected.entries()].map(([reason, count]) => ({ reason, count })),
    },
  };
}

/**
 * Collapses every line of one mutation into a single transaction, or returns
 * the reason it had to be dropped.
 */
export function groupToTransaction(
  idMutation: string,
  lines: readonly RawLine[],
  source: DvfSourceId,
): DvfTransaction | DvfRejectReason {
  const first = lines[0];
  if (!first) return "unusable_mutation";

  // 1 — Price. Repeated on every line: take it once.
  const price = lines.find((l) => l.price !== undefined)?.price;
  if (price === undefined) return "no_price";

  // 2 — Date.
  const date = lines.find((l) => isIsoDate(l.date))?.date;
  if (!date) return "no_date";
  const year = Number(date.slice(0, 4));

  // 3 — Position: mean of the DISTINCT positions, so repeated lines do not
  //     drag the centroid towards the parcel that happens to have most lots.
  const coordinates = meanOfDistinct(lines);
  if (!coordinates) return "no_coordinates";

  // 4 — Surfaces.
  const dwellings = lines.filter((l) => isDwelling(l.localTypeCode));
  const commercial = lines.filter((l) => l.localTypeCode === DVF_LOCAL_TYPE_CODES.commercial);
  const dependencies = lines.filter((l) => l.localTypeCode === DVF_LOCAL_TYPE_CODES.dependency);

  const builtFromDwellings = sumAreas(dwellings);
  const builtFromCommercial = sumAreas(commercial);

  // Parcel surface is repeated on every local line of the same parcel.
  const landByParcel = new Map<string, number>();
  for (const line of lines) {
    if (line.landArea === undefined) continue;
    const key = line.parcelId ?? `${coordinates.lat},${coordinates.lng}`;
    landByParcel.set(key, Math.max(landByParcel.get(key) ?? 0, line.landArea));
  }
  const landArea = [...landByParcel.values()].reduce((a, b) => a + b, 0) || undefined;

  // 5 — Type.
  const propertyType = resolvePropertyType({
    dwellings,
    hasCommercial: commercial.length > 0,
    hasDependency: dependencies.length > 0,
    nature: first.nature,
    landArea,
  });
  if (propertyType === undefined) return "unusable_mutation";

  const builtArea =
    propertyType === "commercial"
      ? plausibleArea(builtFromCommercial)
      : plausibleArea(builtFromDwellings);

  const rooms = sumRooms(dwellings);

  const builtLots = dwellings.length + commercial.length;
  const builtParcels = new Set(
    [...dwellings, ...commercial].map((l) => l.parcelId).filter((p): p is string => Boolean(p)),
  );
  const isMultiLot = builtLots > 1 || builtParcels.size > 1;

  const pricePerSqm =
    builtArea !== undefined && builtArea > 0 ? Math.round(price / builtArea) : undefined;

  const addressSource = dwellings[0] ?? commercial[0] ?? first;

  return {
    id: `${source}:${addressSource.cityCode}:${idMutation}`,
    date,
    year,
    nature: mapMutationNature(first.nature),
    price,
    propertyType,
    propertyTypeLabel: addressSource.localTypeLabel ?? first.localTypeLabel,
    builtArea,
    landArea: plausibleLandArea(landArea),
    rooms,
    addressLabel: formatAddress(addressSource),
    postcode: addressSource.postcode ?? first.postcode,
    city: addressSource.city || first.city,
    cityCode: addressSource.cityCode || first.cityCode,
    departmentCode: addressSource.departmentCode || first.departmentCode,
    coordinates,
    pricePerSqm,
    isMultiLot,
    lotCount: builtLots > 0 ? builtLots : undefined,
    source,
  };
}

/** `Vente en l'état futur d'achèvement` → `sale_off_plan`. */
export function mapMutationNature(raw: string): DvfMutationNature {
  const value = raw.trim().toLowerCase();
  if (value.startsWith("vente en l'état futur") || value.startsWith("vente en l’état futur")) {
    return "sale_off_plan";
  }
  if (value.startsWith("vente terrain")) return "sale_land_to_build";
  if (value.startsWith("vente")) return "sale";
  if (value.startsWith("echange") || value.startsWith("échange")) return "exchange";
  if (value.startsWith("adjudication")) return "auction";
  if (value.startsWith("expropriation")) return "expropriation";
  return "other";
}

/** `code_type_local` → normalised family. Label is only a display fallback. */
export function mapLocalType(code: string | undefined, label?: string): DvfPropertyType | undefined {
  switch (code) {
    case DVF_LOCAL_TYPE_CODES.house:
      return "house";
    case DVF_LOCAL_TYPE_CODES.apartment:
      return "apartment";
    case DVF_LOCAL_TYPE_CODES.dependency:
      return "dependency";
    case DVF_LOCAL_TYPE_CODES.commercial:
      return "commercial";
    default:
      break;
  }
  const normalized = (label ?? "").trim().toLowerCase();
  if (normalized === "maison") return "house";
  if (normalized === "appartement") return "apartment";
  if (normalized === "dépendance" || normalized === "dependance") return "dependency";
  if (normalized.startsWith("local industriel")) return "commercial";
  return undefined;
}

function resolvePropertyType(input: {
  dwellings: readonly RawLine[];
  hasCommercial: boolean;
  hasDependency: boolean;
  nature: string;
  landArea: number | undefined;
}): DvfPropertyType | undefined {
  const { dwellings, hasCommercial, hasDependency, nature, landArea } = input;

  if (dwellings.length > 0) {
    // Dominant type by built surface, not by line count: a 120 m² house sold
    // with three studios stays a house only if it carries the surface.
    const totals = new Map<DvfPropertyType, number>();
    for (const line of dwellings) {
      const type = mapLocalType(line.localTypeCode, line.localTypeLabel);
      if (!type) continue;
      totals.set(type, (totals.get(type) ?? 0) + (line.builtArea ?? 1));
    }
    let best: DvfPropertyType | undefined;
    let bestValue = -1;
    for (const [type, value] of totals) {
      if (value > bestValue) {
        bestValue = value;
        best = type;
      }
    }
    if (best) return best;
  }

  if (hasCommercial) return "commercial";

  const isLandSale = mapMutationNature(nature) === "sale_land_to_build";
  if (isLandSale) return "land";
  if (hasDependency) return "dependency";
  if (landArea !== undefined && landArea > 0) return "land";

  return "other";
}

function toRawLine(
  cells: readonly string[],
  index: Map<string, number>,
  cityCodeOverride: string | undefined,
): RawLine | null {
  const get = (name: string): string | undefined => {
    const i = index.get(name);
    if (i === undefined) return undefined;
    const value = cells[i];
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const idMutation = get("id_mutation");
  if (!idMutation) return null;

  const cityCode = cityCodeOverride ?? get("code_commune");
  if (!cityCode) return null;

  const lon = toNumber(get("longitude"));
  const lat = toNumber(get("latitude"));

  return {
    idMutation,
    date: get("date_mutation") ?? "",
    nature: get("nature_mutation") ?? "",
    price: plausiblePrice(toNumber(get("valeur_fonciere"))),
    addressNumber: get("adresse_numero"),
    addressSuffix: get("adresse_suffixe"),
    street: get("adresse_nom_voie"),
    postcode: get("code_postal"),
    cityCode,
    city: get("nom_commune") ?? "",
    departmentCode: get("code_departement") ?? cityCode.slice(0, 2),
    parcelId: get("id_parcelle"),
    lotCount: toNumber(get("nombre_lots")),
    localTypeCode: get("code_type_local"),
    localTypeLabel: get("type_local"),
    builtArea: toNumber(get("surface_reelle_bati")),
    rooms: toNumber(get("nombre_pieces_principales")),
    landArea: toNumber(get("surface_terrain")),
    natureCulture: get("nature_culture"),
    coordinates:
      lat !== undefined && lon !== undefined && isFrenchIsh(lat, lon) ? { lat, lng: lon } : undefined,
  };
}

function meanOfDistinct(lines: readonly RawLine[]): LatLng | undefined {
  const seen = new Map<string, LatLng>();
  for (const line of lines) {
    if (!line.coordinates) continue;
    seen.set(`${line.coordinates.lat},${line.coordinates.lng}`, line.coordinates);
  }
  if (seen.size === 0) return undefined;
  let lat = 0;
  let lng = 0;
  for (const p of seen.values()) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / seen.size, lng: lng / seen.size };
}

function sumAreas(lines: readonly RawLine[]): number {
  return lines.reduce((total, line) => total + (line.builtArea ?? 0), 0);
}

function sumRooms(lines: readonly RawLine[]): number | undefined {
  let total = 0;
  let seen = false;
  for (const line of lines) {
    if (line.rooms === undefined || line.rooms <= 0) continue;
    total += line.rooms;
    seen = true;
  }
  return seen ? total : undefined;
}

function isDwelling(code: string | undefined): boolean {
  return code === DVF_LOCAL_TYPE_CODES.house || code === DVF_LOCAL_TYPE_CODES.apartment;
}

function formatAddress(line: RawLine): string | undefined {
  const parts = [
    [line.addressNumber, line.addressSuffix].filter(Boolean).join(""),
    toTitleCase(line.street),
  ].filter((p): p is string => Boolean(p && p.length > 0));
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Particles that stay lowercase inside a French street name. */
const LOWERCASE_PARTICLES = new Set([
  "de",
  "du",
  "des",
  "d",
  "le",
  "la",
  "les",
  "l",
  "au",
  "aux",
  "et",
  "en",
  "sur",
  "sous",
  "lès",
  "sainte",
  "saint",
]);

/**
 * DVF ships street names in caps (`RUE DU COUDRAY`); the UI is not a 1990s
 * mainframe. `Saint`/`Sainte` are excluded from the lowercase set at the start
 * of a segment only — `Rue Saint-Jacques` keeps its capital.
 */
function toTitleCase(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const chunks = value.toLocaleLowerCase("fr-FR").split(/(\s|-|')/u);
  let wordIndex = 0;

  return chunks
    .map((chunk, i) => {
      if (!/^[\p{L}]/u.test(chunk)) return chunk;
      const isFirstWord = wordIndex === 0;
      wordIndex += 1;
      const isSaint = chunk === "saint" || chunk === "sainte";
      const afterHyphen = chunks[i - 1] === "-";
      if (!isFirstWord && !afterHyphen && !isSaint && LOWERCASE_PARTICLES.has(chunk)) {
        return chunk;
      }
      return chunk.charAt(0).toLocaleUpperCase("fr-FR") + chunk.slice(1);
    })
    .join("");
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  // Etalab uses a dot, but a hand-edited export may use a comma.
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function plausiblePrice(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value >= MIN_PLAUSIBLE_PRICE && value <= MAX_PLAUSIBLE_PRICE ? value : undefined;
}

function plausibleArea(value: number): number | undefined {
  return value >= MIN_PLAUSIBLE_AREA && value <= MAX_PLAUSIBLE_AREA ? value : undefined;
}

function plausibleLandArea(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value > 0 && value <= 10_000_000 ? value : undefined;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Cheap sanity fence: DVF occasionally carries a swapped or zeroed pair.
 * Covers metropolitan France plus the DROM/COM.
 */
function isFrenchIsh(lat: number, lon: number): boolean {
  if (lat === 0 && lon === 0) return false;
  return lat >= -25 && lat <= 52 && lon >= -64 && lon <= 56;
}

export type { RawLine };
