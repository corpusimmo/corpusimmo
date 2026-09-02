import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/ui";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { webApplicationNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

import { EstimerClient } from "./estimer-client";

const TITLE = "Estimer un bien immobilier gratuitement";

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description:
    "Logement ou local professionnel : une fourchette de valeur calculée sur les ventes " +
    "comparables enregistrées autour du bien. Gratuit, sans compte, méthode publiée.",
  path: "/estimer",
  socialTitle: "Estimer un bien sur les ventes réelles du secteur",
});

export default function EstimerPage() {
  return (
    // Pas de `bg-canvas` ici : le fond du parcours est une photographie posée
    // par le wizard, en `fixed` derrière la page. Un aplat opaque la masquerait
    // entièrement, ce qui était le cas jusqu'ici.
    <div className="py-10 md:py-14">
      {/* L'estimateur est une application, pas un article : il se saisit, il
          calcule, il rend un résultat. Rien n'y est vendu et rien n'y est
          demandé, d'où l'accès libre déclaré. */}
      <JsonLd
        nodes={[
          webApplicationNode({
            name: "Estimateur immobilier CorpusImmo",
            description:
              "Estimation par comparaison à partir des mutations DVF enregistrées autour du bien.",
            path: "/estimer",
            category: "FinanceApplication",
            accessibleForFree: true,
          }),
        ]}
      />
      <div className="container-page">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow">Estimation par comparaison</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
            Combien vaut ce bien, d&apos;après les ventes réelles&nbsp;?
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
            Six questions. Nous cherchons ensuite les mutations enregistrées
            autour de l&apos;adresse, écartons celles qui ne se comparent pas,
            et publions la méthode qui a produit le chiffre.
          </p>

          <div className="mt-8">
            {/* `useSearchParams` impose une frontière Suspense : sans elle, la page
                entière basculerait en rendu dynamique. */}
            <Suspense
              fallback={<LoadingState label="Préparation du parcours…" />}
            >
              <EstimerClient />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
