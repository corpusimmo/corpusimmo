/**
 * `GET /api/dpe?lat=…&lng=…&surface=…` → `{ reading: DpeReading | null }`.
 *
 * Même raisonnement que pour le géocodeur et SIRENE : passer par notre route
 * donne une forme de réponse stable, un cache partagé, aucun hôte tiers dans
 * le `connect-src` de la page, et surtout l'adresse consultée par un visiteur
 * ne part pas de son navigateur vers un service tiers.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AdemeError, readDpe } from "@/lib/dpe/ademe";

export const runtime = "nodejs";

/** Un diagnostic est valable dix ans : le cache peut être long sans mentir. */
const HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  "X-Robots-Tag": "noindex, nofollow",
};

const NO_STORE: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const rawSurface = params.get("surface");
  const surface = rawSurface === null ? undefined : Number(rawSurface);

  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    (surface === undefined || (Number.isFinite(surface) && surface > 0));

  if (!valid) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Coordonnées manquantes ou hors bornes.",
        },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const reading = await readDpe(lat, lng, surface);
    return NextResponse.json({ reading }, { headers: HEADERS });
  } catch (error) {
    const status = error instanceof AdemeError ? error.status : 502;
    return NextResponse.json(
      {
        error: {
          code: "ademe_unavailable",
          message: "La base des diagnostics est momentanément indisponible.",
        },
      },
      { status: status === 429 ? 429 : 502, headers: NO_STORE },
    );
  }
}
