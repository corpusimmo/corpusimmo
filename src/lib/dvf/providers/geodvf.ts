/**
 * Default provider — Etalab "DVF géolocalisées".
 *
 * `https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/communes/{dep}/{insee}.csv`
 * is the reference open dataset: every notarial mutation registered by the
 * DGFiP, already geocoded to the parcel. No key, no quota, one file per commune
 * and per millésime (2021 → today), 150 kB for a Paris arrondissement, ~2.2 MB
 * for Nantes.
 *
 * Consequence on the query path: we cannot ask "give me this rectangle". We
 * resolve which communes the viewport touches, download those commune-years
 * once, keep them in process memory, and filter locally. Hence the explicit
 * fetch budget below — an unbounded viewport must never fan out.
 */

import type {
  DvfBoundsQuery,
  DvfProvider,
  DvfRadiusQuery,
  DvfResult,
  DvfTransaction,
} from "@/types/dvf";
import { DvfProviderError } from "@/types/dvf";
import type { BBox, Commune } from "@/types/geo";
import { bboxAround } from "@/lib/geo/distance";
import { communesInBBox, MAX_COMMUNES_PER_QUERY } from "@/lib/geo/communes";
import { departmentCodeFromInsee, expandPlmCommune, isPlmParentCommune } from "@/lib/geo/insee";
import { createAsyncCache, DVF_MAX_CACHED_COMMUNE_YEARS, DVF_TTL_MS } from "../cache";
import { inBBox, selectRows, withinRadius } from "../filters";
import { DvfParseError, parseGeoDvfCsv } from "../normalize";

const BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv";

/** First millésime published in the geolocated flavour. 2020 returns 404. */
export const GEO_DVF_FIRST_YEAR = 2021;

/**
 * How many commune×year CSVs one request may download. Each is up to a few MB;
 * beyond this the request stops being an interactive query.
 */
const MAX_COMMUNE_YEAR_FETCHES = 24;

/** Parallelism against files.data.gouv.fr — polite and still fast. */
const FETCH_CONCURRENCY = 6;

/** Default window when the caller gives no year bounds. */
const DEFAULT_YEAR_SPAN = 3;

const communeYearCache = createAsyncCache<DvfTransaction[]>({
  ttlMs: DVF_TTL_MS,
  maxEntries: DVF_MAX_CACHED_COMMUNE_YEARS,
});

/** Exposed for tests and for the `/api` layer to reason about coverage. */
export function currentMaxYear(): number {
  return new Date().getUTCFullYear();
}

export function resolveYearRange(yearMin?: number, yearMax?: number): number[] {
  const hardMax = currentMaxYear();
  const max = clamp(yearMax ?? hardMax, GEO_DVF_FIRST_YEAR, hardMax);
  const min = clamp(yearMin ?? max - (DEFAULT_YEAR_SPAN - 1), GEO_DVF_FIRST_YEAR, max);
  const years: number[] = [];
  // Newest first: if the budget clips the list, we keep the useful end.
  for (let y = max; y >= min; y -= 1) years.push(y);
  return years;
}

export const geoDvfProvider: DvfProvider = {
  id: "geodvf",
  label: "DVF géolocalisées (Etalab / DGFiP)",

  async getTransactionsByBounds(query: DvfBoundsQuery): Promise<DvfResult> {
    return runQuery(query.bbox, query, inBBox(query.bbox));
  },

  async getTransactionsNearPoint(query: DvfRadiusQuery): Promise<DvfResult> {
    const bbox = bboxAround(query.center, query.radius);
    return runQuery(bbox, query, withinRadius(query.center, query.radius));
  },

  async getTransactionById(id: string): Promise<DvfTransaction | null> {
    const parsed = parseTransactionId(id);
    if (!parsed) return null;

    const rows = await loadCommuneYear(parsed.cityCode, parsed.year).catch((error: unknown) => {
      if (error instanceof DvfProviderError) throw error;
      return [] as DvfTransaction[];
    });
    return rows.find((row) => row.id === id) ?? null;
  },
};

async function runQuery(
  bbox: BBox,
  query: DvfBoundsQuery | DvfRadiusQuery,
  predicate: (row: DvfTransaction) => boolean,
): Promise<DvfResult> {
  const years = resolveYearRange(query.yearMin, query.yearMax);
  const maxCommunes = clamp(
    Math.floor(MAX_COMMUNE_YEAR_FETCHES / Math.max(1, years.length)),
    1,
    MAX_COMMUNES_PER_QUERY,
  );

  const { communes, truncated: communesTruncated } = await communesInBBox(bbox, { maxCommunes });
  if (communes.length === 0) {
    return {
      transactions: [],
      count: 0,
      truncated: false,
      source: "geodvf",
      communes: [],
    };
  }

  const targets = toFileTargets(communes, maxCommunes);
  const jobs: { cityCode: string; year: number; primary: boolean }[] = [];
  for (const target of targets) {
    for (const year of years) {
      jobs.push({ cityCode: target.code, year, primary: target.primary });
    }
  }

  const loaded = await runWithConcurrency(jobs, FETCH_CONCURRENCY, async (job) => {
    try {
      return await loadCommuneYear(job.cityCode, job.year);
    } catch (error) {
      // The commune under the cursor is not optional: failing it silently would
      // show an empty map as if there had been no sales.
      if (job.primary) throw error;
      return [] as DvfTransaction[];
    }
  });

  const all = loaded.flat();
  const { rows, truncated } = selectRows(all, query, predicate);

  let latestYear: number | undefined;
  for (const row of all) {
    if (latestYear === undefined || row.year > latestYear) latestYear = row.year;
  }

  return {
    transactions: rows,
    count: rows.length,
    truncated: truncated || communesTruncated || targets.length < communes.length,
    source: "geodvf",
    communes: communes.map((c) => c.name),
    latestYear,
  };
}

interface FileTarget {
  code: string;
  primary: boolean;
}

/**
 * INSEE codes → the codes DVF actually publishes.
 *
 * Paris / Lyon / Marseille only reach this point when the BAN refinement in
 * `communes.ts` failed; expanding all 20 Paris arrondissements would blow the
 * budget, so we take what fits and let `truncated` say so.
 */
function toFileTargets(communes: readonly Commune[], maxCommunes: number): FileTarget[] {
  const targets: FileTarget[] = [];
  const seen = new Set<string>();

  communes.forEach((commune, communeIndex) => {
    const codes = isPlmParentCommune(commune.code)
      ? expandPlmCommune(commune.code)
      : [commune.code];
    for (const code of codes) {
      if (seen.has(code) || targets.length >= maxCommunes) continue;
      seen.add(code);
      targets.push({ code, primary: communeIndex === 0 && codes.length === 1 });
    }
  });

  return targets;
}

/**
 * One commune-year, normalised. Cached and in-flight deduplicated: twenty
 * concurrent pans over Nantes trigger exactly one download.
 */
export async function loadCommuneYear(cityCode: string, year: number): Promise<DvfTransaction[]> {
  return communeYearCache.get(`${cityCode}:${year}`, () => fetchCommuneYear(cityCode, year));
}

async function fetchCommuneYear(cityCode: string, year: number): Promise<DvfTransaction[]> {
  const department = departmentCodeFromInsee(cityCode);
  if (!department) return [];

  const url = `${BASE_URL}/${year}/communes/${department}/${cityCode}.csv`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "text/csv" },
      // Past mutations never change; only the yearly millésime does. Files
      // above Next's 2 MB data-cache ceiling simply fall back to the process
      // cache above, which is why both layers exist.
      next: { revalidate: 86_400 },
    });
  } catch (error) {
    throw new DvfProviderError(
      "Les fichiers DVF d'Etalab sont momentanément injoignables.",
      error,
      503,
    );
  }

  // A millésime that does not exist yet (or a commune with no sale that year)
  // is a legitimate empty answer, not an incident.
  if (response.status === 404 || response.status === 403) return [];

  if (!response.ok) {
    throw new DvfProviderError(
      `Le service DVF a répondu ${response.status} pour la commune ${cityCode} (${year}).`,
      undefined,
      502,
    );
  }

  const csv = await response.text();
  try {
    const { transactions } = parseGeoDvfCsv(csv, { source: "geodvf", cityCode });
    return transactions;
  } catch (error) {
    if (error instanceof DvfParseError) {
      throw new DvfProviderError(`Fichier DVF illisible pour ${cityCode} (${year}).`, error, 502);
    }
    throw error;
  }
}

/** `geodvf:44109:2024-532458` */
export function parseTransactionId(id: string): { cityCode: string; year: number } | null {
  const parts = id.split(":");
  if (parts.length !== 3 || parts[0] !== "geodvf") return null;
  const cityCode = parts[1];
  const mutation = parts[2];
  if (!cityCode || !mutation) return null;
  const year = Number(mutation.slice(0, 4));
  if (!Number.isInteger(year) || year < GEO_DVF_FIRST_YEAR || year > currentMaxYear() + 1) {
    return null;
  }
  return { cityCode, year };
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await worker(item);
    }
  });

  await Promise.all(runners);
  return results;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
