/**
 * `POST /api/estimation` — calcule une valorisation par comparaison.
 *
 * Publique par conception : estimer un bien est le haut de l'entonnoir et doit
 * fonctionner sans compte. Rien ici ne fait confiance à l'appelant — le corps
 * passe par le contrat zod avant qu'une seule ligne DVF ne soit lue.
 *
 * Codes de statut :
 *  - 200 avec un `ValuationResult`. Un résultat dont le `status` vaut `"failed"`
 *    reste un 200 : la requête était valide et on y a répondu honnêtement
 *    (« nous ne pouvons pas produire de chiffre, voici pourquoi »). Seules les
 *    erreurs de transport et de programmation donnent un 4xx/5xx.
 *  - 400 quand le corps n'est pas une `ValuationRequest` valide.
 *  - 500 quand le moteur lui-même échoue.
 *
 * Le résultat n'est PAS stocké : il est renvoyé en entier, et la page le garde.
 * C'est ce qui permet à cette version de tourner sans base de données, et au
 * PDF de se fabriquer à partir du même objet — voir `./pdf/route.ts`.
 */

import { NextResponse } from "next/server";
import { estimateByComparison, parseValuationRequest } from "@/lib/valuation";

export const runtime = "nodejs";
/** Une estimation dépend d'un corps : il n'y a rien à pré-rendre ni à cacher. */
export const dynamic = "force-dynamic";
/** Le moteur peut télécharger plusieurs Mo de CSV DVF : 15 s serait juste. */
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "invalid_json",
          message: "Le corps de la requête n'est pas un JSON valide.",
        },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = parseValuationRequest(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Les informations transmises sont incomplètes ou invalides.",
          details: parsed.issues,
        },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const result = await estimateByComparison(parsed.data);
    return NextResponse.json(result, { status: 200, headers: NO_STORE });
  } catch (error) {
    // Ne jamais renvoyer le corps en écho : il porte une adresse saisie par
    // quelqu'un.
    console.error("[api/estimation] estimation impossible", error);
    return NextResponse.json(
      {
        error: {
          code: "estimation_failed",
          message: "L'estimation n'a pas pu être calculée. Réessayez dans quelques instants.",
        },
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
