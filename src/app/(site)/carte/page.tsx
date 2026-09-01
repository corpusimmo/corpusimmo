import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

import { CarteClient } from "./carte-client";

const TITLE = "Carte des ventes immobilières enregistrées";
const DESCRIPTION =
  "Explorez sur une carte les ventes immobilières réellement enregistrées en France : prix, " +
  "surface, date et type de bien, à partir des données publiques DVF publiées par la DGFiP.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/carte" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/carte`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function CartePage() {
  return (
    <>
      {/* La page EST la carte. Le titre existe pour les technologies
          d'assistance et pour les moteurs, qui ne savent pas lire un canevas. */}
      <h1 className="sr-only">
        Carte des ventes immobilières enregistrées en France, données DVF
      </h1>
      <CarteClient />
    </>
  );
}
