import type { Metadata } from "next";

import { ObservatoireWorkspace } from "@/components/observatoire/observatoire-workspace";
import { PageContainer } from "@/components/observatoire/page-container";
import { PageHeader } from "@/components/ui";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { webApplicationNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * INDEXABLE, et sans contradiction avec le décret du 28/12/2018.
 *
 * Ce que le robot reçoit, c'est l'OUTIL : un titre, une description, une carte
 * vide et des filtres. Pas une seule mutation détaillée n'est rendue côté
 * serveur — la donnée DVF arrive par `fetch` après l'hydratation. On indexe
 * donc la page d'outil, jamais le jeu de données.
 */
export const metadata: Metadata = pageMetadata({
  title: "Observatoire du marché immobilier",
  description:
    "Prix médian au m², volumes et dispersion par secteur, calculés sur les mutations " +
    "réellement enregistrées. Consultation libre, sans compte, données publiques DVF.",
  path: "/observatoire",
  socialTitle: "L'observatoire du marché, sur les ventes réelles",
});

export default function ObservatoirePage() {
  return (
    <>
      {/* Hors du conteneur, et pas dedans : `space-y-4` pose une marge sur tout
          enfant qui suit un frère, et le <script> en deviendrait le premier,
          décalant l'en-tête de seize pixels pour rien.

          `WebApplication` et pas `Dataset` : la page rend un OUTIL, et le
          serveur n'y publie aucune mutation. Le jeu de données, lui, est celui
          de la DGFiP et vit sur data.gouv.fr. Voir `src/lib/seo/json-ld.ts`. */}
      <JsonLd
        nodes={[
          webApplicationNode({
            name: "Observatoire du marché immobilier CorpusImmo",
            description:
              "Indicateurs de marché calculés sur les mutations DVF : prix au m², volumes, dispersion.",
            path: "/observatoire",
            category: "BusinessApplication",
            accessibleForFree: true,
          }),
        ]}
      />
      <PageContainer className="space-y-4">
        <PageHeader
          title="Observatoire"
          description="Les mutations réellement enregistrées, à l'échelle de la rue, avec les indicateurs qui vont avec. Ajoutez les ventes pertinentes à votre sélection : elle vous suit d'un écran à l'autre."
        />
        <ObservatoireWorkspace />
      </PageContainer>
    </>
  );
}
