/**
 * `GET /api/geocode?q=…&limit=7` → `{ results: GeoAddress[] }`.
 *
 * Proxying the Géoplateforme instead of calling it from the browser buys three
 * things: one stable response shape, a shared edge cache, and no third-party
 * host in the page's connect-src.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { formatIssues, geocodeQuerySchema } from "@/lib/dvf/query-schema";
import { GeocoderError, searchAddresses } from "@/lib/geo/geocoder";

export const runtime = "nodejs";

/** Address lookups are personal-ish input: never let a crawler index them. */
const HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: NextRequest) {
  const parsed = geocodeQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "invalid_request", message: formatIssues(parsed.error) } },
      { status: 400, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  }

  try {
    const results = await searchAddresses(parsed.data.q, { limit: parsed.data.limit ?? 7 });
    return NextResponse.json({ results }, { headers: HEADERS });
  } catch (error) {
    const status = error instanceof GeocoderError ? error.status : 502;
    const message =
      error instanceof GeocoderError
        ? error.message
        : "La recherche d'adresse est momentanément indisponible.";
    return NextResponse.json(
      { error: { code: "geocoder_unavailable", message } },
      {
        status: status === 429 ? 429 : 502,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
      },
    );
  }
}
