import type { Metadata } from "next";

import { PageContainer } from "@/components/observatoire/page-container";
import { TransactionsExplorer } from "@/components/observatoire/transactions-explorer";
import { PageHeader } from "@/components/ui";
import { siteConfig } from "@/config/site";

/**
 * INDEXABLE — même raisonnement que `/observatoire` : la page rendue côté
 * serveur est un formulaire de recherche vide. Les mutations n'apparaissent
 * qu'après une requête explicite du visiteur, côté client.
 */
export const metadata: Metadata = {
  title: "Rechercher une transaction immobilière",
  description:
    "Recherchez les ventes immobilières enregistrées autour d'une adresse : prix, surface, prix " +
    "au m², date et type de bien, triables et filtrables (données publiques DVF).",
  alternates: { canonical: "/observatoire/transactions" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/observatoire/transactions`,
    title: "Rechercher une transaction immobilière",
    description:
      "La recherche tabulaire des ventes réellement enregistrées, autour de n'importe quelle adresse en France.",
  },
};

export default function ObservatoireTransactionsPage() {
  return (
    <PageContainer className="space-y-4">
      <PageHeader
        title="Rechercher une transaction"
        description="Triez, filtrez, et alimentez votre sélection de comparables ligne par ligne. Consultation et export sont libres."
      />
      <TransactionsExplorer />
    </PageContainer>
  );
}
