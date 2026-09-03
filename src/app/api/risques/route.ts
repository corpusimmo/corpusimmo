/**
 * `GET /api/risques?lat=…&lng=…` → `{ reading: RiskReading | null }`.
 *
 * Même raisonnement que pour le géocodeur, SIRENE et le DPE : passer par notre
 * route donne une forme de réponse stable, un cache partagé, aucun hôte tiers
 * dans le `connect-src` de la page, et surtout la parcelle consultée par un
 * visiteur ne part pas de son navigateur vers un service tiers.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { GeorisquesError, readRisks } from "@/lib/georisques/api";

export const runtime = "nodejs";

/**
 * Un zonage de risque bouge à l'échelle de l'arrêté préfectoral, pas de la
 * semaine : le cache peut être long sans mentir.
 */
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

  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

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
    const reading = await readRisks(lat, lng);
    return NextResponse.json({ reading }, { headers: HEADERS });
  } catch (error) {
    const status = error instanceof GeorisquesError ? error.status : 502;
    return NextResponse.json(
      {
        error: {
          code: "georisques_unavailable",
          message: "La base des risques est momentanément indisponible.",
        },
      },
      { status: status === 429 ? 429 : 502, headers: NO_STORE },
    );
  }
}
