import type { Metadata } from "next";
import { headers } from "next/headers";

import { pageMetadata } from "@/lib/seo/metadata";

/**
 * PAGE DE DIAGNOSTIC, TEMPORAIRE.
 *
 * En production, les deux seules pages rendues à la demande servaient un HTML
 * complet mais SANS `<title>`, et leur charge RSC portait
 * `"metadata":"$undefined","error":"$Z"` : le rendu des métadonnées échouait,
 * et l'écran d'erreur prenait la main à l'hydratation. En local, le même code
 * et la même construction n'ont jamais reproduit la panne.
 *
 * Cette page ne fait rien d'autre qu'être dynamique et déclarer un titre. Si
 * elle perd le sien en production, la cause est le rendu à la demande
 * lui-même, pas ce que nos pages contiennent. À retirer dès la réponse
 * obtenue.
 */
export const metadata: Metadata = pageMetadata({
  title: "Diagnostic de rendu",
  description:
    "Page technique temporaire, servie à la demande, qui ne sert qu'à vérifier que les métadonnées sortent bien.",
  path: "/diagnostic-rendu",
  index: false,
});

export const dynamic = "force-dynamic";

export default async function DiagnosticRendu() {
  const entetes = await headers();
  return (
    <main className="container-page py-20">
      <h1 className="font-display text-2xl text-ink">Diagnostic de rendu</h1>
      <p className="mt-4 text-sm text-ink-muted">
        Rendu à la demande, {new Date().toISOString()}, hôte{" "}
        {entetes.get("host") ?? "inconnu"}.
      </p>
    </main>
  );
}
