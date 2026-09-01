import type { Metadata } from "next";

import { ToolLibrary } from "@/components/tools/tool-library";
import { toolCatalogue } from "@/data/tools-catalogue";
import { siteConfig } from "@/config/site";

const TITLE = "Outils de calcul immobilier";
const DESCRIPTION =
  "Dix calculateurs métier, gratuits et sans compte : rentabilité locative, coût réel d'un prêt, " +
  "capacité d'emprunt, arbitrage fiscal, DCF sur dix ans, charge foncière, WAULT, avis de valeur, " +
  "net vendeur, chiffrage de travaux.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/outils" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    url: `${siteConfig.url}/outils`,
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function OutilsPage() {
  return (
    <div className="bg-canvas py-10 md:py-14">
      <div className="container-page">
        <header className="max-w-2xl">
          <p className="eyebrow">Bibliothèque</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
            Dix outils de calcul, ouverts
          </h1>
          <p className="mt-3 leading-relaxed text-ink-muted">
            Les mêmes calculs que les feuilles qu&apos;on se transmet entre professionnels, mais
            avec les barèmes affichés, modifiables, et datés. Rien à télécharger, rien à créer.
          </p>
        </header>

        <div className="mt-10">
          <ToolLibrary tools={toolCatalogue} />
        </div>
      </div>
    </div>
  );
}
