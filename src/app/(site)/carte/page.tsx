import type { Metadata } from "next";

import { JsonLd } from "@/lib/seo/json-ld-script";
import { webApplicationNode } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

import { CarteClient } from "./carte-client";

export const metadata: Metadata = pageMetadata({
  title: "Carte des ventes immobilières enregistrées",
  description:
    "Explorez sur une carte les ventes immobilières enregistrées en France : prix, surface, " +
    "date et type de bien, à partir des données publiques DVF de la DGFiP.",
  path: "/carte",
  socialTitle: "La carte des ventes réellement enregistrées",
});

export default function CartePage() {
  return (
    <>
      {/* La carte est libre : ni compte, ni quota, ni bandeau à fermer. */}
      <JsonLd
        nodes={[
          webApplicationNode({
            name: "Carte des ventes immobilières CorpusImmo",
            description:
              "Les mutations DVF enregistrées en France, situées et consultables sur une carte.",
            path: "/carte",
            category: "BusinessApplication",
            accessibleForFree: true,
          }),
        ]}
      />
      {/* La page EST la carte. Le titre existe pour les technologies
          d'assistance et pour les moteurs, qui ne savent pas lire un canevas. */}
      <h1 className="sr-only">
        Carte des ventes immobilières enregistrées en France, données DVF
      </h1>
      <CarteClient />
    </>
  );
}
