/**
 * `GET /api/ressources/[slug]/telechargement?t=<jeton>` → le fichier.
 *
 * C'est le SEUL chemin vers un octet de `content/aimants/`. Ce répertoire est
 * hors de `public/` à dessein : un fichier posé dans `public/` serait servi
 * directement par le CDN, sans jamais passer par cette vérification.
 *
 * Le jeton est revérifié à CHAQUE requête — signature, expiration, et document
 * visé. Il n'y a pas de session, pas de cookie, rien à faire confiance d'autre.
 */

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { NextResponse } from "next/server";

import { maskEmail } from "@/lib/email";
import { getMagnet } from "@/lib/magnets/catalogue";
import { verifyDownloadToken } from "@/lib/magnets/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Un lien signé ne doit jamais être mis en cache par un intermédiaire. */
const HEADERS = {
  "cache-control": "no-store, private",
  "x-robots-tag": "noindex, nofollow, noarchive",
} as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;
  const magnet = getMagnet(slug);
  if (!magnet) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Ce document n'existe pas." } },
      { status: 404, headers: HEADERS },
    );
  }

  const token = new URL(request.url).searchParams.get("t") ?? "";
  const verdict = verifyDownloadToken(token, slug);

  if (!verdict.valid) {
    // Un message par cause, mais AUCUN détail cryptographique : on dit à la
    // personne quoi faire, jamais à un attaquant où il en est.
    const messages: Record<typeof verdict.reason, string> = {
      not_configured: "Le téléchargement est momentanément indisponible.",
      malformed: "Ce lien est incomplet. Redemandez-en un depuis la fiche du document.",
      bad_signature: "Ce lien n'est pas valide. Redemandez-en un depuis la fiche du document.",
      wrong_document: "Ce lien ne correspond pas à ce document.",
      expired: "Ce lien a expiré. Redemandez-en un depuis la fiche du document.",
    };
    const status = verdict.reason === "not_configured" ? 503 : 403;
    return NextResponse.json(
      { error: { code: verdict.reason, message: messages[verdict.reason] } },
      { status, headers: HEADERS },
    );
  }

  // `basename` sur un nom qui vient de NOTRE catalogue : la valeur est déjà
  // sûre, mais la contrainte est écrite plutôt que supposée — le jour où le
  // catalogue viendra d'ailleurs, la garde sera déjà là.
  const path = join(process.cwd(), "content", "aimants", basename(magnet.fileName));

  try {
    const bytes = await readFile(path);
    console.info(
      `[api/ressources] « ${slug} » téléchargé par ${maskEmail(verdict.email)}`,
    );
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        ...HEADERS,
        "content-type": magnet.contentType,
        "content-disposition": `attachment; filename="${basename(magnet.fileName)}"`,
      },
    });
  } catch (error) {
    console.error(`[api/ressources] fichier illisible pour « ${slug} »`, error);
    return NextResponse.json(
      {
        error: {
          code: "file_missing",
          message: "Le document est momentanément indisponible. Réessayez plus tard.",
        },
      },
      { status: 503, headers: HEADERS },
    );
  }
}
