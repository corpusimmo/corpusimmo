import type { Metadata } from "next";

import { ObservatoireWorkspace } from "@/components/observatoire/observatoire-workspace";
import { PageContainer } from "@/components/observatoire/page-container";
import { PageHeader } from "@/components/ui";
import { siteConfig } from "@/config/site";

/**
 * INDEXABLE, et sans contradiction avec le décret du 28/12/2018.
 *
 * Ce que le robot reçoit, c'est l'OUTIL : un titre, une description, une carte
 * vide et des filtres. Pas une seule mutation détaillée n'est rendue côté
 * serveur — la donnée DVF arrive par `fetch` après l'hydratation. On indexe
 * donc la page d'outil, jamais le jeu de données.
 */
export const metadata: Metadata = {
  title: "Observatoire du marché immobilier",
  description:
    "La carte des ventes, augmentée : prix médian au m², volumes, dispersion et sélection de " +
    "comparables sur les mutations réellement enregistrées (données publiques DVF).",
  alternates: { canonical: "/observatoire" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/observatoire`,
    title: "Observatoire du marché immobilier",
    description:
      "Indicateurs de marché, statistiques d'emprise et comparables, à partir des ventes réellement enregistrées.",
  },
};

export default function ObservatoirePage() {
  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Observatoire"
        description="Les mutations réellement enregistrées, à l'échelle de la rue, avec les indicateurs qui vont avec. Ajoutez les ventes pertinentes à votre sélection : elle vous suit d'un écran à l'autre."
      />
      <ObservatoireWorkspace />
    </PageContainer>
  );
}
