/**
 * `POST /api/estimation/pdf` → `application/pdf`.
 *
 * POURQUOI UN POST, ET PAS `GET /api/estimation/[id]/pdf`
 *   Aucun résultat n'est stocké dans cette version (voir `../route.ts`). Le
 *   rapport se fabrique donc à partir du `ValuationResult` que la page détient
 *   déjà — celui-là même que le moteur vient de lui renvoyer. Un identifiant
 *   dans l'URL supposerait un stockage : ce serait promettre un lien
 *   partageable qui ne survivrait pas au rechargement.
 *
 * Le document est regénéré à chaque demande plutôt qu'archivé : il est bon
 * marché à reconstruire, et il ne peut jamais être périmé par rapport au
 * résultat qu'il décrit.
 *
 * Tourne sur le runtime Node — l'écrivain PDF n'utilise que des `Uint8Array`,
 * mais l'expliciter documente que cette route n'est pas compatible edge par
 * accident.
 */

import { NextResponse } from "next/server";

import { estimationPdfFilename, renderEstimationPdf } from "@/lib/pdf/estimation-pdf";
import { parseValuationResult } from "@/lib/valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_json", message: "Corps de requête illisible." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const valuation = parseValuationResult(body);
  if (!valuation) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Le résultat d'estimation transmis est incomplet ou invalide.",
        },
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const bytes = await renderEstimationPdf(valuation, { detailed: true });
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${estimationPdfFilename(valuation)}"`,
        // Le rapport porte une adresse : ni cache partagé, ni indexation.
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error("[api/estimation/pdf] génération impossible", error);
    return NextResponse.json(
      {
        error: {
          code: "pdf_failed",
          message: "Le rapport n'a pas pu être généré.",
        },
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
