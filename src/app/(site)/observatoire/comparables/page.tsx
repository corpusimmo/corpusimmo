import type { Metadata } from "next";

import { ComparablesPanel } from "@/components/observatoire/comparables-panel";
import { PageContainer } from "@/components/observatoire/page-container";
import { PageHeader } from "@/components/ui";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * `noindex` — et pour deux raisons qui se rejoignent.
 *
 * 1. Il n'y a rien à indexer : la page rend une sélection PERSONNELLE, tenue
 *    dans le navigateur du visiteur ou dans son compte. Un robot n'y verrait
 *    qu'un état vide.
 * 2. Ce qu'elle affiche, quand elle affiche quelque chose, ce sont des
 *    mutations DVF détaillées, adresse comprise. Le décret du 28/12/2018
 *    interdit leur indexation.
 *
 * `follow` reste vrai : les liens sortants vers l'observatoire et la recherche
 * doivent continuer d'irriguer le reste du site.
 */
export const metadata: Metadata = pageMetadata({
  title: "Mes comparables",
  description:
    "Votre sélection de références de marché, conservée d'un écran à l'autre : excluez " +
    "sans supprimer, mesurez la dispersion, emportez-la en tableur.",
  path: "/observatoire/comparables",
  index: false,
});

export default function ObservatoireComparablesPage() {
  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Mes comparables"
        description="La sélection de références de marché. Excluez sans supprimer, mesurez la dispersion, emportez-la en tableur."
      />
      <ComparablesPanel />
    </PageContainer>
  );
}
