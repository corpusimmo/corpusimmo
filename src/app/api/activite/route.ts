/**
 * `GET /api/activite?lat=…&lng=…` → `{ hint: ActivityHint | null }`.
 *
 * Passer par notre route plutôt que d'appeler SIRENE depuis le navigateur
 * achète trois choses, exactement comme pour le géocodeur : une forme de
 * réponse stable, un cache partagé côté edge, et aucun hôte tiers dans le
 * `connect-src` de la page. S'y ajoute ici un quatrième argument : l'adresse
 * qu'un visiteur consulte ne part pas de son navigateur vers un service tiers.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { describeActivity, SireneError } from "@/lib/enrichment/sirene";

export const runtime = "nodejs";

/**
 * Le répertoire SIRENE bouge à la semaine, pas à la minute : un cache long est
 * honnête et épargne l'API publique.
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
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  // Bornes métropole + outre-mer, larges : c'est un garde-fou contre les
  // paramètres absurdes, pas un filtre géographique.
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
    const hint = await describeActivity(lat, lng);
    return NextResponse.json({ hint }, { headers: HEADERS });
  } catch (error) {
    const status = error instanceof SireneError ? error.status : 502;
    return NextResponse.json(
      {
        error: {
          code: "sirene_unavailable",
          message: "Le répertoire SIRENE est momentanément indisponible.",
        },
      },
      { status: status === 429 ? 429 : 502, headers: NO_STORE },
    );
  }
}
