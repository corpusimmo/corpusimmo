import type { Metadata } from "next";

import { PageContainer } from "@/components/observatoire/page-container";
import { TransactionsExplorer } from "@/components/observatoire/transactions-explorer";
import { PageHeader } from "@/components/ui";
import { JsonLd } from "@/lib/seo/json-ld-script";
import { breadcrumbNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * INDEXABLE — même raisonnement que `/observatoire` : la page rendue côté
 * serveur est un formulaire de recherche vide. Les mutations n'apparaissent
 * qu'après une requête explicite du visiteur, côté client.
 */
export const metadata: Metadata = pageMetadata({
  title: "Rechercher une transaction immobilière",
  description:
    "Recherchez les ventes enregistrées autour d'une adresse, triez-les par prix, surface, " +
    "date ou prix au m², et emportez la sélection en tableur. Données publiques DVF.",
  path: "/observatoire/transactions",
  socialTitle: "Rechercher une vente enregistrée, adresse par adresse",
});

export default function ObservatoireTransactionsPage() {
  return (
    <>
      {/* Hors du conteneur : `space-y-4` décalerait l'en-tête si le <script>
          en était le premier enfant.

          Page de deuxième niveau : le fil d'Ariane double le lien de retour
          que l'écran propose déjà, il n'invente aucune arborescence. */}
      <JsonLd
        nodes={[
          breadcrumbNode([
            { name: "Accueil", path: "/" },
            { name: "Observatoire", path: "/observatoire" },
            { name: "Rechercher une transaction", path: "/observatoire/transactions" },
          ]),
        ]}
      />
      <PageContainer className="space-y-4">
        <PageHeader
          title="Rechercher une transaction"
          description="Triez, filtrez, et alimentez votre sélection de comparables ligne par ligne. Consultation et export sont libres."
        />
        <TransactionsExplorer />
      </PageContainer>
    </>
  );
}
